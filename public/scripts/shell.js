/* ============================================================
   emela — Front management : châssis partagé (C4-FRONT, DEC-264)
   - AUTH RÉELLE : session native Frappe. Au chargement de toute
     page applicative, whoami() vérifie la session ; absente ou
     expirée → redirection /connexion. (L'ancienne gate
     localStorage de la maquette est SUPPRIMÉE.)
   - Le rôle vient du SERVEUR (whoami.roles) — l'UX masque ce que
     le rôle ne peut pas faire (data-roles) ; la sécurité reste
     portée par les endpoints role-gardés.
   ============================================================ */
(function () {
  const ROLE_HOME = {
    admin: '/espace-administratif',
    resp: '/cockpit-responsable',
    dir: '/tableau-direction',
    sm: '/personnel',
  };
  const ROLE_LABEL = {
    admin: "Agent d'admission",
    resp: 'Responsable admission',
    dir: 'Direction',
    sm: 'Super-admin (SM)',
  };
  // SM = super-admin de domaine : superset d'AFFICHAGE (voit toutes les sections).
  const VISIBLE_CODES = {
    admin: ['admin'], resp: ['resp'], dir: ['dir'],
    sm: ['admin', 'resp', 'dir', 'sm'],
  };

  function initials(name) {
    return (name || '?').split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  }

  function applyRole(role, me) {
    document.body.setAttribute('data-role', role);

    // Carte utilisateur : identité RÉELLE de session (plus de profils fictifs)
    const nm = document.querySelector('.app-user .nm');
    const rl = document.querySelector('.app-user .rl');
    const av = document.querySelector('.app-user .av');
    if (nm) nm.textContent = me.full_name || me.user;
    if (rl) rl.textContent = ROLE_LABEL[role] || role;
    if (av) av.textContent = initials(me.full_name || me.user);

    // Nav + contenu : gating d'AFFICHAGE par rôle (UX — le serveur refuse de toute façon).
    // SM voit le superset (admin+resp+dir+sm) ; les autres ne voient que leur code.
    const visible = VISIBLE_CODES[role] || [role];
    document.querySelectorAll('[data-roles]').forEach(el => {
      el.hidden = !el.getAttribute('data-roles').split(/\s+/).some(r => visible.includes(r));
    });
    document.querySelectorAll('.nav a[data-home]').forEach(a => a.setAttribute('href', ROLE_HOME[role]));

    if (typeof window.onEmelaRole === 'function') window.onEmelaRole(role, me);
  }

  async function boot() {
    let me = null;
    try {
      me = await window.EmelaAPI.whoami(); // session absente/expirée → api.js redirige /connexion
    } catch (e) {
      return; // la redirection est déjà en cours
    }
    const role = window.EmelaAPI.uxRole(me.roles);
    window.EmelaShell.role = role;
    window.EmelaShell.me = me;
    applyRole(role, me);

    // A-04 : cible du lien d'évitement (id + focusable) sur le contenu principal
    const main = document.querySelector('main');
    if (main) { if (!main.id) main.id = 'main-content'; main.setAttribute('tabindex', '-1'); }

    // Déconnexion : la carte utilisateur reste cliquable…
    const userCard = document.querySelector('.app-user');
    if (userCard) {
      userCard.style.cursor = 'pointer';
      userCard.title = 'Se déconnecter';
      userCard.addEventListener('click', () => window.EmelaAPI.logout());
      // …+ un BOUTON VISIBLE « Déconnexion » (la carte seule n'était pas découvrable).
      if (!document.querySelector('.app-logout')) {
        const btn = document.createElement('button');
        btn.type = 'button';
        // F-05 : variante du design system au lieu de styles inline
        btn.className = 'app-logout em-btn em-btn--secondary em-btn--sm';
        btn.textContent = 'Déconnexion';
        btn.title = 'Se déconnecter';
        btn.style.marginLeft = 'var(--space-4, 14px)';
        btn.style.whiteSpace = 'nowrap';
        btn.addEventListener('click', (e) => { e.stopPropagation(); window.EmelaAPI.logout(); });
        userCard.parentNode.insertBefore(btn, userCard.nextSibling);
      }
    }
  }

  window.EmelaShell = { ROLE_HOME, ROLE_LABEL, role: null, me: null };
  document.addEventListener('DOMContentLoaded', boot);
})();
