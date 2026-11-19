// The child's home: avatar, parent gear (red dot when a recommendation waits) and one big tile
// per category that has a game. No text. Pace and evening mode come from shared/runtime.js.
import { categoriesWithGames } from '../jeux/registry.js';
import { getCollection, getEffective, onEffectiveChange, clock } from './runtime.js';
import { recommendations } from './recommendations.js';
import { drawAvatar } from './avatar.js';
import { openParent } from './parent.js';

const $ = id => document.getElementById(id);
const BASE_FADE_MS = 300;

// Resolves the art's URL and tells whether it loads. Pictures that are missing keep their CSS
// fallback; this check is repeated on every start, so art added later is picked up.
const artCache = new Map();
function artUrl(path) {
  const url = new URL(path, document.baseURI).href;
  if (!artCache.has(url)) {
    artCache.set(url, new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = () => resolve(null);
      img.src = url;
    }));
  }
  return artCache.get(url);
}

// Sets --name to the image and adds class (on el) once it loads.
function useArt(el, path, varName, cls) {
  return artUrl(path).then(url => {
    if (!url) return;
    el.style.setProperty(varName, `url("${url}")`);
    el.classList.add(cls);
  });
}

let effective = getEffective();
let view = 'home'; // 'home' | a category id (list of its games)

function applyEffective() {
  const b = document.body;
  b.classList.toggle('evening', effective.evening);
  $('moon').hidden = !effective.evening;
  b.style.setProperty('--anim', effective.factors.anim);
  b.style.setProperty('--fade', `${Math.round(BASE_FADE_MS * effective.factors.transition)}ms`);
  // background art: the evening one at night (until it loads, the CSS gradient stays)
  b.classList.remove('has-bg');
  useArt(b, `shared/assets/home-bg-${effective.evening ? 'evening' : 'day'}.svg`, '--bg', 'has-bg');
}

function go(path) {
  document.body.classList.add('leaving');
  setTimeout(() => { location.href = path; }, BASE_FADE_MS * effective.factors.transition);
}

function tileButton(id, art, small = false) {
  const t = document.createElement('button');
  t.type = 'button';
  t.className = small ? 'tile small' : 'tile';
  t.id = id;
  if (art) useArt(t, art, '--art', 'has-art');
  return t;
}

function renderTiles() {
  const box = $('tiles');
  box.replaceChildren();
  const old = $('back');
  if (old) old.remove();
  const cats = categoriesWithGames();
  if (view === 'home') {
    for (const cat of cats) {
      const t = tileButton(`tile-${cat.id}`, cat.tile);
      t.addEventListener('click', () => {
        if (cat.games.length === 1) go(cat.games[0].path);
        else { view = cat.id; renderTiles(); }
      });
      box.append(t);
    }
    return;
  }
  const cat = cats.find(c => c.id === view);
  for (const g of cat.games) {
    const t = tileButton(`tile-${g.id}`, g.tile ?? null, true);
    t.addEventListener('click', () => go(g.path));
    box.append(t);
  }
  const back = document.createElement('button');
  back.type = 'button';
  back.id = 'back';
  back.setAttribute('aria-label', 'Accueil');
  useArt(document.body, 'shared/assets/icon-home.svg', '--home-icon', 'has-home-icon');
  back.addEventListener('click', () => { view = 'home'; renderTiles(); });
  $('home').append(back);
}

function refresh() {
  const c = getCollection();
  effective = getEffective();
  applyEffective();
  drawAvatar($('avatar').querySelector('canvas'), c.avatar);
  $('gear').querySelector('.dot').hidden = recommendations(c, clock()).length === 0;
}

useArt(document.body, 'shared/assets/icon-gear.svg', '--gear', 'has-gear');
useArt(document.body, 'shared/assets/moon.svg', '--moon', 'has-moon');
$('gear').addEventListener('click', () => openParent($('parent'), { onClose: refresh }));
// Back from a game (bfcache) or a reload: show the home again, with the current settings.
window.addEventListener('pageshow', () => { document.body.classList.remove('leaving'); refresh(); });
onEffectiveChange(() => refresh());
renderTiles();
refresh();
