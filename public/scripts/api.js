/* ============================================================
   emela — Front management : client API (C4-FRONT, DEC-264)
   - Session NATIVE Frappe : cookie sid (credentials: include)
   - CSRF : token de session récupéré via staff.whoami, envoyé
     en X-Frappe-CSRF-Token sur tous les POST
   - Erreurs normalisées {code, message, httpStatus} ; 401/403
     d'auth → redirection /connexion (le SERVEUR porte la
     sécurité ; le front ne fait que refléter)
   - ARGENT : fmtXOF = AFFICHAGE uniquement, aucun calcul de
     montant côté front (le back fait foi)
   ============================================================ */
(function () {
  const BASE = window.EMELA_API_BASE || 'http://admission-dev.localhost:8000';
  const S = window.sessionStorage;

  function csrf() { return S.getItem('emela_csrf') || ''; }

  function authError(status, body) {
    // Session absente/expirée ou CSRF invalide → retour connexion
    const excType = (body && (body.exc_type || body.exception)) || '';
    return status === 401
      || /SessionExpired|AuthenticationError|CSRFTokenError|PermissionError: You do not have enough permissions/i.test(String(excType))
      || (status === 403 && /CSRF/i.test(JSON.stringify(body || {})));
  }

  async function request(path, { method = 'GET', params = null, body = null, raw = false } = {}) {
    let url = BASE + path;
    const init = { method, credentials: 'include', headers: { Accept: 'application/json' } };
    if (params) url += '?' + new URLSearchParams(params).toString();
    if (method !== 'GET') {
      init.headers['Content-Type'] = 'application/json';
      init.headers['X-Frappe-CSRF-Token'] = csrf();
      if (body) init.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch(url, init);
    } catch (e) {
      throw { code: 'NETWORK', message: 'Serveur injoignable. Vérifiez votre connexion.', httpStatus: 0 };
    }
    if (raw) {
      if (!res.ok) throw { code: 'HTTP_' + res.status, message: 'Téléchargement impossible.', httpStatus: res.status };
      return res;
    }
    let json = null;
    try { json = await res.json(); } catch (e) { /* corps non-JSON */ }
    if (authError(res.status, json)) {
      S.removeItem('emela_csrf'); S.removeItem('emela_user');
      if (window.location.pathname !== '/connexion') {
        window.location.href = '/connexion?expire=1';
      }
      throw { code: 'AUTH', message: 'Session expirée ou rôle admission absent.', httpStatus: res.status };
    }
    const message = json && json.message !== undefined ? json.message : json;
    // Enveloppe maison {ok, data, error} des endpoints admission
    if (message && typeof message === 'object' && 'ok' in message) {
      if (!message.ok) {
        const err = message.error || {};
        throw { code: err.code || 'ERROR', message: err.message || 'Action refusée.', httpStatus: res.status };
      }
      return message.data;
    }
    if (!res.ok) {
      const m = (json && (json._server_messages || json.exception)) || ('Erreur HTTP ' + res.status);
      throw { code: 'HTTP_' + res.status, message: String(m).slice(0, 300), httpStatus: res.status };
    }
    return message;
  }

  const staffCall = (fn, opts) => request('/api/method/admission.api.staff.' + fn, opts);

  const API = {
    BASE,

    /* ---- session (DEC-264) ---- */
    async login(usr, pwd) {
      const res = await fetch(BASE + '/api/method/login', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({ usr, pwd }),
      });
      if (!res.ok) {
        throw { code: 'LOGIN_FAILED', message: 'Identifiant ou mot de passe incorrect.', httpStatus: res.status };
      }
      return API.whoami();
    },
    async whoami() {
      const me = await staffCall('whoami');
      S.setItem('emela_csrf', me.csrf_token || '');
      S.setItem('emela_user', JSON.stringify({ user: me.user, full_name: me.full_name, roles: me.roles }));
      return me;
    },
    me() { try { return JSON.parse(S.getItem('emela_user')); } catch (e) { return null; } },
    async logout() {
      try { await fetch(BASE + '/api/method/logout', { credentials: 'include' }); } catch (e) {}
      S.removeItem('emela_csrf'); S.removeItem('emela_user');
      window.location.href = '/connexion';
    },
    /* Rôle UX (admin/resp/dir) depuis les rôles SERVEUR — priorité dir > resp > admin */
    uxRole(roles) {
      if ((roles || []).includes('Admission Direction')) return 'dir';
      if ((roles || []).includes('Admission Responsable')) return 'resp';
      return 'admin';
    },

    /* ---- lectures (get_list → DocPerms + cloisonnement DEC-262) ---- */
    listDossiers(params) { return staffCall('list_dossiers', { params: params || {} }); },
    getDossier(id) { return staffCall('get_dossier', { params: { dossier_id: id } }); },
    statsDirection() { return staffCall('stats_direction'); },
    resource(doctype, fields, filters, orderBy) {
      const p = { fields: JSON.stringify(fields), limit_page_length: 200 };
      if (filters) p.filters = JSON.stringify(filters);
      if (orderBy) p.order_by = orderBy;
      return request('/api/resource/' + encodeURIComponent(doctype), { params: p }).then(r => r.data || r);
    },

    /* ---- actions C1/C2/C3 (POST role-gardés serveur) ---- */
    startReview(id) { return staffCall('start_review', { method: 'POST', body: { dossier_id: id } }); },
    requestComplement(id, motif) { return staffCall('request_complement', { method: 'POST', body: { dossier_id: id, motif } }); },
    markAdmissible(id) { return staffCall('mark_admissible', { method: 'POST', body: { dossier_id: id } }); },
    waitlist(id, rang) { return staffCall('waitlist', { method: 'POST', body: { dossier_id: id, rang } }); },
    refuse(id, motif) { return staffCall('refuse', { method: 'POST', body: { dossier_id: id, motif } }); },
    saisirNotes(id, notes) { return staffCall('saisir_note_concours', { method: 'POST', body: { dossier_id: id, notes } }); },
    validerNotes(id) { return staffCall('valider_notes_concours', { method: 'POST', body: { dossier_id: id } }); },
    verifyBac(id) { return staffCall('verify_bac_diploma', { method: 'POST', body: { dossier_id: id } }); },
    conditionalAdmission(id) { return staffCall('conditional_admission', { method: 'POST', body: { dossier_id: id } }); },
    liftCondition(id, bourses) { return staffCall('lift_condition', { method: 'POST', body: { dossier_id: id, bourses_validees: bourses } }); },
    refuseCondition(id, motif) { return staffCall('refuse_condition', { method: 'POST', body: { dossier_id: id, motif } }); },
    proposeScholarships(id, bourses) { return staffCall('propose_scholarships', { method: 'POST', body: { dossier_id: id, bourses } }); },
    acceptAdmission(id, bourses) {
      const body = { dossier_id: id };
      if (bourses !== null && bourses !== undefined) body.bourses_validees = bourses;
      return staffCall('accept_admission', { method: 'POST', body });
    },
    enroll(id) { return staffCall('enroll', { method: 'POST', body: { dossier_id: id } }); },

    /* ---- LOT W : cycle de vie complet (B0.1-B0.4) ---- */
    withdraw(id, motif) { return staffCall('withdraw', { method: 'POST', body: { dossier_id: id, motif } }); },
    setWaitlistRank(id, rang) { return staffCall('set_waitlist_rank', { method: 'POST', body: { dossier_id: id, rang } }); },
    closeSession(session, motif, dryRun) {
      return staffCall('close_session', {
        method: 'POST',
        body: { session, motif: motif || null, dry_run: dryRun ? 1 : 0 },
      });
    },

    /* ---- paiement agent (ARGENT — montants serveur, jamais calculés ici) ---- */
    confirmOfflinePayment(id, mode, justificatif, paymentId) {
      return staffCall('confirm_offline_payment', {
        method: 'POST',
        body: { dossier_id: id, payment_mode: mode, justificatif, payment_id: paymentId || null },
      });
    },
    initiateOnlinePayment(id, feeType, acompte) {
      return staffCall('initiate_online_payment', {
        method: 'POST',
        body: { dossier_id: id, fee_type: feeType || 'application', acompte_xof: acompte || 0 },
      });
    },
    async uploadJustificatif(file) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('is_private', '1');
      const res = await fetch(BASE + '/api/method/upload_file', {
        method: 'POST', credentials: 'include',
        headers: { 'X-Frappe-CSRF-Token': csrf(), Accept: 'application/json' },
        body: fd,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json || !json.message || !json.message.file_url) {
        throw { code: 'UPLOAD_FAILED', message: 'Échec du dépôt du justificatif.', httpStatus: res.status };
      }
      return json.message.file_url;
    },
    async downloadReceipt(paymentId) {
      const res = await request('/api/method/admission.api.staff.download_receipt',
        { params: { payment_id: paymentId }, raw: true });
      const ct = res.headers.get('Content-Type') || '';
      if (ct.includes('json')) {
        // l'endpoint a renvoyé une erreur métier (NOT_CONFIRMED…) au lieu du PDF
        const json = await res.json();
        const err = (json.message && json.message.error) || {};
        throw { code: err.code || 'ERROR', message: err.message || 'Reçu indisponible.', httpStatus: 409 };
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'recu-' + paymentId + '.pdf';
      a.click();
      URL.revokeObjectURL(a.href);
    },

    /* ---- affichage (JAMAIS de calcul de montant) ---- */
    fmtXOF(n) {
      if (n === null || n === undefined || n === '') return '—';
      return Number(n).toLocaleString('fr-FR').replace(/ | /g, ' ') + ' FCFA';
    },
    fmtDate(d) {
      if (!d) return '—';
      try { return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }); }
      catch (e) { return String(d); }
    },
  };

  window.EmelaAPI = API;
})();
