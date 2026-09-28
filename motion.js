(function () {
  'use strict';
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const running = new Set();
  let previousKey = null;
  function animate(element, frames, options) {
    if (preference.matches || !element.animate) return;
    const animation = element.animate(frames, options);
    running.add(animation);
    animation.finished.catch(() => {}).finally(() => running.delete(animation));
  }
  preference.addEventListener('change', () => {
    if (preference.matches) { running.forEach(animation => animation.cancel()); running.clear(); }
  });
  window.HubMotion = {
    capture() {
      return Array.from(document.querySelectorAll('#view .finance-fill, #view .trend-bar'), element => ({
        axis: element.classList.contains('finance-fill') ? 'width' : 'height',
        value: element.classList.contains('finance-fill') ? element.style.width : element.style.height
      }));
    },
    render(key, previousBars = [], navigationClick = false) {
      const changedPage = previousKey !== key;
      previousKey = key;
      if (preference.matches) return;
      if (changedPage || navigationClick) {
        running.forEach(animation => animation.cancel());
        running.clear();
        const view = document.getElementById('view');
        if (view) animate(view, [{opacity: .35, transform: 'translateY(12px)'}, {opacity: 1, transform: 'translateY(0)'}], {duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)'});
        if (navigationClick) document.querySelectorAll('#navigation .nav-item.active, #mobile-navigation button.active').forEach(element => {
          animate(element, [{transform: 'scale(.96)', backgroundColor: '#c4dcff'}, {transform: 'scale(1)', backgroundColor: '#edf4ff'}], {duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)'});
        });
      } else {
        document.querySelectorAll('#view .finance-fill, #view .trend-bar').forEach((element, index) => {
          const old = previousBars[index];
          const axis = element.classList.contains('finance-fill') ? 'width' : 'height';
          const value = element.style[axis];
          if (old?.axis === axis && old.value !== value) animate(element, [{[axis]: old.value}, {[axis]: value}], {duration: 360, easing: 'cubic-bezier(.2,.8,.2,1)'});
        });
      }
    }
  };
})();
