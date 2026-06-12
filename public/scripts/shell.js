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
  };
  const ROLE_LABEL = {
    admin: "Agent d'admission",
    resp: 'Responsable admission',
    dir: 'Direction',
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

    // Nav + contenu : gating d'AFFICHAGE par rôle (UX — le serveur refuse de toute façon)
    document.querySelectorAll('[data-roles]').forEach(el => {
      el.hidden = !el.getAttribute('data-roles').split(/\s+/).includes(role);
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

    // Déconnexion : la carte utilisateur devient le bouton logout
    const userCard = document.querySelector('.app-user');
    if (userCard) {
      userCard.style.cursor = 'pointer';
      userCard.title = 'Se déconnecter';
      userCard.addEventListener('click', () => window.EmelaAPI.logout());
    }
  }

  window.EmelaShell = { ROLE_HOME, ROLE_LABEL, role: null, me: null };
  document.addEventListener('DOMContentLoaded', boot);
})();
