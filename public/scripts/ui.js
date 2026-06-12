/* ============================================================
   emela — Front management : UI helpers (C4-FRONT)
   - emModal : modale générique (champs texte/textarea/number/
     select/checkbox-list/file) sur le design system em-*
   - emToast : retour utilisateur succès/erreur
   Les erreurs API (403 rôle, 409 état…) remontent le MESSAGE
   SERVEUR : le front n'invente pas de règle métier.
   ============================================================ */
(function () {
  function el(tag, attrs, html) {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => { if (v !== null && v !== undefined) n.setAttribute(k, v); });
    if (html !== undefined) n.innerHTML = html;
    return n;
  }

  /* ---------- toast ---------- */
  let toastBox;
  function emToast(message, type) {
    if (!toastBox) {
      toastBox = el('div', { style: 'position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;max-width:420px' });
      document.body.appendChild(toastBox);
    }
    const colors = { success: 'var(--success-700, #15803d)', error: 'var(--danger-700, #b91c1c)', info: 'var(--ink-800, #1f2937)' };
    const t = el('div', {
      style: 'background:' + (colors[type] || colors.info) + ';color:#fff;padding:12px 16px;border-radius:10px;' +
        'font-size:13.5px;line-height:1.45;box-shadow:0 8px 24px rgba(0,0,0,.18);',
      role: 'status',
    });
    t.textContent = message;
    toastBox.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 450); }, type === 'error' ? 6000 : 3500);
  }

  /* ---------- modale ----------
     emModal({ title, lead, fields:[{name,label,type,required,options,placeholder,value,help}],
               submitLabel, danger, onSubmit(values) → Promise })
     onSubmit qui rejette → l'erreur s'affiche DANS la modale (message serveur). */
  function emModal(cfg) {
    const overlay = el('div', { style: 'position:fixed;inset:0;background:rgba(15,12,35,.45);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px' });
    const box = el('div', { style: 'background:var(--surface-paper,#fff);border-radius:14px;max-width:540px;width:100%;max-height:90vh;overflow:auto;padding:26px 26px 22px;box-shadow:0 24px 64px rgba(0,0,0,.25)' });
    overlay.appendChild(box);

    box.appendChild(el('h3', { style: 'font-family:var(--font-display);font-size:19px;font-weight:700;margin:0 0 6px' }, cfg.title || ''));
    if (cfg.lead) box.appendChild(el('p', { style: 'font-size:13.5px;color:var(--text-secondary);margin:0 0 16px;line-height:1.5' }, cfg.lead));

    const form = el('form', { novalidate: '' });
    box.appendChild(form);
    const inputs = {};

    (cfg.fields || []).forEach(f => {
      const wrap = el('div', { style: 'margin-bottom:14px' });
      if (f.type !== 'checkbox-list') {
        wrap.appendChild(el('label', { style: 'display:block;font-size:13px;font-weight:600;margin-bottom:6px' },
          f.label + (f.required ? ' <span style="color:var(--danger-600,#dc2626)">*</span>' : '')));
      }
      let input;
      if (f.type === 'textarea') {
        input = el('textarea', { class: 'em-input', rows: 3, placeholder: f.placeholder || '' });
        input.value = f.value || '';
      } else if (f.type === 'select') {
        input = el('select', { class: 'em-input' });
        (f.options || []).forEach(o => input.appendChild(el('option', { value: o.value }, o.label)));
        if (f.value) input.value = f.value;
      } else if (f.type === 'file') {
        input = el('input', { type: 'file', class: 'em-input', accept: f.accept || '' });
      } else if (f.type === 'checkbox-list') {
        input = el('fieldset', { style: 'border:1px solid var(--border-default,#e5e7eb);border-radius:10px;padding:12px 14px;margin:0' });
        input.appendChild(el('legend', { style: 'font-size:13px;font-weight:600;padding:0 6px' }, f.label));
        (f.options || []).forEach(o => {
          const row = el('label', { style: 'display:flex;gap:10px;align-items:flex-start;padding:7px 2px;font-size:13.5px;cursor:pointer' });
          const cb = el('input', { type: 'checkbox', value: o.value, style: 'margin-top:2px' });
          if (o.checked) cb.checked = true;
          row.appendChild(cb);
          // Données SERVEUR (noms de bourses…) → textContent, jamais innerHTML (anti-XSS)
          const span = el('span', {});
          span.textContent = o.label;
          if (o.hint) {
            const hint = el('span', { style: 'color:var(--text-tertiary);font-size:12px' });
            hint.textContent = ' · ' + o.hint;
            span.appendChild(hint);
          }
          row.appendChild(span);
          input.appendChild(row);
        });
      } else if (f.type === 'rows') {
        // lignes dynamiques {clé: valeur numérique} — saisie des notes de concours
        input = el('div', {});
        const list = el('div', {});
        input.appendChild(list);
        function addRow(k, v) {
          const r = el('div', { style: 'display:flex;gap:8px;margin-bottom:8px' });
          r.appendChild(el('input', { class: 'em-input', placeholder: f.keyPlaceholder || 'Épreuve', value: k || '', 'data-k': '' }));
          r.appendChild(el('input', { class: 'em-input', type: 'number', step: '0.01', placeholder: f.valPlaceholder || 'Note', value: v ?? '', 'data-v': '', style: 'max-width:110px' }));
          const del = el('button', { type: 'button', class: 'em-btn em-btn--ghost em-btn--sm' }, '✕');
          del.addEventListener('click', () => r.remove());
          r.appendChild(del);
          list.appendChild(r);
        }
        Object.entries(f.value || {}).forEach(([k, v]) => addRow(k, v));
        if (!Object.keys(f.value || {}).length) addRow('', '');
        const add = el('button', { type: 'button', class: 'em-btn em-btn--secondary em-btn--sm' }, '+ Ajouter une épreuve');
        add.addEventListener('click', () => addRow('', ''));
        input.appendChild(add);
        input._getRows = () => {
          const out = {};
          list.querySelectorAll(':scope > div').forEach(r => {
            const k = r.querySelector('[data-k]').value.trim();
            const v = r.querySelector('[data-v]').value;
            if (k) out[k] = Number(v);
          });
          return out;
        };
      } else {
        input = el('input', { type: f.type || 'text', class: 'em-input', placeholder: f.placeholder || '', value: f.value ?? '' });
      }
      inputs[f.name] = { input, field: f };
      wrap.appendChild(input);
      if (f.help) wrap.appendChild(el('div', { style: 'font-size:12px;color:var(--text-tertiary);margin-top:5px;line-height:1.45' }, f.help));
      form.appendChild(wrap);
    });

    const errBox = el('div', { style: 'display:none;background:var(--danger-50,#fef2f2);color:var(--danger-700,#b91c1c);border-radius:8px;padding:10px 12px;font-size:13px;margin:4px 0 12px;line-height:1.45' });
    form.appendChild(errBox);

    const foot = el('div', { style: 'display:flex;gap:10px;justify-content:flex-end;margin-top:6px' });
    const cancel = el('button', { type: 'button', class: 'em-btn em-btn--secondary' }, 'Annuler');
    const submit = el('button', { type: 'submit', class: 'em-btn ' + (cfg.danger ? 'em-btn--danger' : 'em-btn--primary') }, cfg.submitLabel || 'Confirmer');
    foot.appendChild(cancel); foot.appendChild(submit);
    form.appendChild(foot);

    function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    cancel.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);

    form.addEventListener('submit', async e => {
      e.preventDefault();
      errBox.style.display = 'none';
      const values = {};
      for (const [name, { input, field }] of Object.entries(inputs)) {
        let v;
        if (field.type === 'checkbox-list') v = [...input.querySelectorAll('input:checked')].map(c => c.value);
        else if (field.type === 'file') v = input.files[0] || null;
        else if (field.type === 'rows') v = input._getRows();
        else v = input.value;
        if (field.required && (v === '' || v === null || (Array.isArray(v) && false) || (field.type === 'rows' && !Object.keys(v).length))) {
          errBox.textContent = 'Le champ « ' + field.label + ' » est obligatoire.';
          errBox.style.display = 'block';
          return;
        }
        values[name] = v;
      }
      submit.disabled = true; submit.textContent = '…';
      try {
        await cfg.onSubmit(values);
        close();
      } catch (err) {
        // Message SERVEUR affiché tel quel (403 rôle, 409 état, EXCLUSIVITY_CONFLICT, GATE_FAILED…)
        errBox.textContent = '[' + (err.code || 'ERREUR') + '] ' + (err.message || 'Action refusée.');
        errBox.style.display = 'block';
        submit.disabled = false; submit.textContent = cfg.submitLabel || 'Confirmer';
      }
    });

    document.body.appendChild(overlay);
    const first = form.querySelector('input,textarea,select');
    if (first) first.focus();
    return { close };
  }

  /* Échappement HTML pour les pages qui composent du markup avec des données serveur.
     (Les libellés de modale/toast passent déjà par textContent.) */
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  window.EmelaUI = { emModal, emToast, esc };
})();
