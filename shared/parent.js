// The parent space (French, plain words). An overlay on the home: Profil, Rythme, Mode soir,
// Recommandations, Jeux. Every change is saved at once through updateCollection.
import { GAMES } from '../jeux/registry.js';
import { getCollection, updateCollection, clock } from './runtime.js';
import { ageFrom, ageLabel, isFutureBirth } from './profile.js';
import { PACES, recommendedPace } from './pace.js';
import { recommendations, applyRecommendation, ignoreRecommendation } from './recommendations.js';
import { drawAvatar, stepAvatar, randomAvatar, DEFAULT_AVATAR } from './avatar.js';

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const PACE_TEXT = {
  calme: ['Calme', 'Transitions plus lentes, moins d\'effets.'],
  normal: ['Normal', 'Rythme habituel des jeux.'],
  rapide: ['Rapide', 'Transitions plus courtes.'],
};

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null) el.append(kid);
  return el;
}

const button = (text, onclick, cls = '') => h('button', { type: 'button', class: cls, onclick }, text);

// Times every half hour, plus the stored one when it is something else.
function timeOptions(current) {
  const out = [];
  for (let m = 0; m < 24 * 60; m += 30) out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${m % 60 === 0 ? '00' : '30'}`);
  if (!out.includes(current)) out.push(current);
  return out.sort();
}

export function openParent(root, { onClose } = {}) {
  const save = fn => updateCollection(fn);
  const now = () => clock();
  // The profile needs a valid birth month and year. Until then it is removed (the selects and the
  // stored profile always agree) and the first name is kept alone in draftName.
  const start = getCollection();
  const draft = { name: start.profile?.name ?? start.draftName, month: start.profile?.month ?? 0, year: start.profile?.year ?? 0 };
  const sections = {};
  const dateComplete = () => draft.month > 0 && draft.year > 0;
  const dateInFuture = () => dateComplete() && isFutureBirth(draft, now());

  function saveProfile() {
    const name = draft.name.trim();
    if (dateComplete() && !dateInFuture()) {
      save(c => ({ ...c, profile: { name, month: draft.month, year: draft.year }, draftName: '' }));
    } else {
      save(c => ({ ...c, profile: null, draftName: name }));
    }
  }

  // ---- Profil ----
  function profil() {
    const c = getCollection();
    const thisYear = now().getFullYear();
    const years = [];
    for (let y = thisYear; y >= thisYear - 15; y--) years.push(y);
    const name = h('input', { type: 'text', value: draft.name, id: 'p-name', maxlength: 30, autocomplete: 'off' });
    name.addEventListener('input', () => {
      draft.name = name.value;
      saveProfile();
      refresh('rythme', 'recos'); // not the profile: the field must keep its focus
    });
    const month = h('select', { id: 'p-month', 'aria-label': 'Mois de naissance' },
      h('option', { value: 0 }, 'Mois'),
      MONTHS.map((m, i) => h('option', { value: i + 1, selected: draft.month === i + 1 }, m)));
    const year = h('select', { id: 'p-year', 'aria-label': 'Année de naissance' },
      h('option', { value: 0 }, 'Année'),
      years.map(y => h('option', { value: y, selected: draft.year === y }, String(y))));
    const onDate = () => {
      draft.month = Number(month.value);
      draft.year = Number(year.value);
      saveProfile();
      refresh('profil', 'rythme', 'recos');
    };
    month.addEventListener('change', onDate);
    year.addEventListener('change', onDate);

    const canvas = h('canvas', { width: 240, height: 240 });
    drawAvatar(canvas, c.avatar ?? DEFAULT_AVATAR);
    const setAvatar = fn => { save(cc => ({ ...cc, avatar: fn(cc.avatar ?? DEFAULT_AVATAR) })); refresh('profil'); };
    const profile = getCollection().profile;
    return h('section', { class: 'p-sec', id: 'sec-profil' },
      h('h2', {}, 'Profil'),
      h('p', { class: 'p-note' }, 'Ces informations restent sur la tablette. Le prénom est pour vous, l\'enfant ne le voit pas.'),
      h('div', { class: 'p-row' }, h('label', { for: 'p-name' }, 'Prénom'), name),
      h('div', { class: 'p-row' }, h('label', {}, 'Naissance'), month, year,
        profile ? h('span', {}, ageLabel(ageFrom(profile, now()))) : null),
      dateInFuture() ? h('p', { class: 'p-warn', id: 'p-date-warn' }, 'Cette date est dans le futur : choisissez le mois et l\'année de naissance.') : null,
      h('div', { class: 'p-row p-avatar' }, canvas,
        button('◀ Précédent', () => setAvatar(a => stepAvatar(a, -1))),
        button('Au hasard', () => setAvatar(a => randomAvatar(a))),
        button('Suivant ▶', () => setAvatar(a => stepAvatar(a, 1)))));
  }

  // ---- Rythme ----
  function rythme() {
    const c = getCollection();
    const rec = c.profile ? recommendedPace(ageFrom(c.profile, now())) : null;
    return h('section', { class: 'p-sec', id: 'sec-rythme' },
      h('h2', {}, 'Rythme'),
      h('p', { class: 'p-note' }, 'La vitesse des écrans et des animations dans tous les jeux.'),
      h('div', { class: 'p-choices' }, PACES.map(p => h('button', {
        type: 'button',
        class: p === c.pace ? 'picked' : '',
        'data-pace': p,
        'aria-pressed': p === c.pace,
        onclick: () => { save(cc => ({ ...cc, pace: p })); refresh('rythme', 'recos'); },
      }, PACE_TEXT[p][0], p === rec ? h('span', { class: 'p-badge' }, 'conseillé') : null,
      h('br'), h('small', {}, PACE_TEXT[p][1])))));
  }

  // ---- Mode soir ----
  function soir() {
    const c = getCollection();
    const e = c.evening;
    const sel = (key, label) => h('select', {
      'aria-label': label,
      onchange: ev => { save(cc => ({ ...cc, evening: { ...cc.evening, [key]: ev.target.value } })); refresh('soir', 'recos'); },
    }, timeOptions(e[key]).map(t => h('option', { value: t, selected: t === e[key] }, t)));
    return h('section', { class: 'p-sec', id: 'sec-soir' },
      h('h2', {}, 'Mode soir'),
      h('p', { class: 'p-note' }, 'Pendant ces heures : couleurs plus douces et plus sombres, pas de confettis, rythme calme quel que soit le réglage.'),
      h('div', { class: 'p-row' },
        button(e.enabled ? 'Activé' : 'Désactivé', () => {
          save(cc => ({ ...cc, evening: { ...cc.evening, enabled: !cc.evening.enabled } }));
          refresh('soir', 'recos');
        }, e.enabled ? 'on' : ''),
        h('label', {}, 'De'), sel('start', 'Heure de début'),
        h('label', {}, 'à'), sel('end', 'Heure de fin')),
      e.start === e.end
        ? h('p', { class: 'p-warn', id: 'p-soir-warn' }, 'Le début et la fin sont à la même heure : le mode soir ne s\'active jamais. Choisissez deux heures différentes.')
        : null);
  }

  // ---- Recommandations ----
  function recos() {
    const c = getCollection();
    const list = recommendations(c, now());
    const card = r => h('div', { class: 'p-card', 'data-reco': r.id },
      h('p', {}, r.text),
      h('div', { class: 'p-row' },
        r.id === 'profil'
          ? button('Remplir le profil', () => { document.getElementById('p-name')?.focus(); sections.profil.scrollIntoView({ behavior: 'smooth' }); }, 'primary')
          : button('Appliquer', () => { save(cc => applyRecommendation(cc, r.id, now())); refresh('rythme', 'soir', 'recos'); }, 'primary'),
        button('Ignorer', () => { save(cc => ignoreRecommendation(cc, r)); refresh('recos'); })));
    return h('section', { class: 'p-sec', id: 'sec-recos' },
      h('h2', {}, 'Recommandations'),
      list.length ? list.map(card) : h('p', { class: 'p-note' }, 'Rien à signaler pour le moment.'));
  }

  // ---- Jeux ----
  const resetting = new Set(); // game ids waiting for the confirmation
  const done = new Set();
  function jeux() {
    return h('section', { class: 'p-sec', id: 'sec-jeux' },
      h('h2', {}, 'Jeux'),
      GAMES.map(g => h('div', { class: 'p-card', 'data-game': g.id },
        h('p', {}, h('b', {}, g.name ?? g.id)),
        resetting.has(g.id)
          ? h('div', { class: 'p-row' },
            h('span', {}, 'Effacer toute la progression de ce jeu (pièces, achats) ? Cela ne peut pas être annulé.'),
            button('Oui, effacer', () => {
              try { g.reset(globalThis.localStorage); } catch { /* storage refused: nothing to clear */ }
              resetting.delete(g.id); done.add(g.id); refresh('jeux');
            }, 'danger'),
            button('Annuler', () => { resetting.delete(g.id); refresh('jeux'); }))
          : h('div', { class: 'p-row' },
            button('Remettre à zéro', () => { done.delete(g.id); resetting.add(g.id); refresh('jeux'); }),
            done.has(g.id) ? h('span', { class: 'p-ok' }, 'Progression effacée.') : null))));
  }

  const builders = { profil, rythme, soir, recos, jeux };
  const wrap = h('div', { class: 'p-wrap' });

  function refresh(...names) {
    for (const n of names) {
      const next = builders[n]();
      sections[n].replaceWith(next);
      sections[n] = next;
    }
  }

  function close() {
    root.hidden = true;
    root.replaceChildren();
    onClose?.();
  }

  wrap.append(h('div', { class: 'p-head' }, h('h1', {}, 'Espace parent'), button('Fermer', close, 'primary')));
  for (const n of Object.keys(builders)) {
    sections[n] = builders[n]();
    wrap.append(sections[n]);
  }
  root.replaceChildren(wrap);
  root.hidden = false;
  root.scrollTop = 0;
}
