import SlideV from '../slide-v';

require('./app.css');

const prev = document.querySelector('.prev');
const next = document.querySelector('.next');
const destroy = document.querySelector('.destroy');
const prepend = document.querySelector('.prepend');


const mySlideV = new SlideV({
  // containerSelector: '.my-carousel',
  slidesInFrame: 3,
  step: 2,
  transitionDuration: 1000,
  draggable: true,
  dragThreshold: 0.2,
  slideElemClass: 'slide',
  movingElemClass: 'moving-container',
  onMoveEnd: () => {
    console.log('onMoveEnd');
  },
  onSlideClick(slideElem) {
    console.log(slideElem);
  },
});

next.addEventListener('click', () => {
  mySlideV.next();
});
prev.addEventListener('click', () => {
  mySlideV.prev();
});
destroy.addEventListener('click', () => {
  mySlideV.destroy({ initialMarkup: true });
});
prepend.addEventListener('click', () => {
  mySlideV.remove(0);
});


// mySlideV.next({ step: 2, isAnimated: false, callback: () => { mySlideV.next(); } });
// mySlideV.prev();
