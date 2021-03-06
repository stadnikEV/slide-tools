import isCorrectContainerStructure from './utils/is-correct-container-structure';
import setDefaultPropertyOfConfig from './utils/set-default-property-of-config';
import matchesPolyfill from './utils/matches-polyfill';
import closestPolyfill from './utils/closest-polyfill';
import mathSignPolyfill from './utils/math-sign-polyfil';
import bindPolyfill from './utils/bind-polyfil';


export default class SlideV {
  constructor(configuration) {
    let config = configuration;
    // если нет конфиг объекта, создать его
    if (!config) config = {};

    if (!isCorrectContainerStructure(config)) return;
    this._config = setDefaultPropertyOfConfig(config);

    // полифилы
    mathSignPolyfill();
    matchesPolyfill(Element.prototype);
    closestPolyfill(Element.prototype);
    bindPolyfill();

    // оборачиваем обработчики событий и сохраняем в пременные
    [
      '_onClick',
      '_onTransitionEnd',
      '_onResize',
      '_onTouchStart',
      '_onTouchMove',
      '_onTouchEnd',
      '_onMouseDown',
      '_onMouseMove',
      '_onMouseLeave',
      '_onMouseUp',
      '_onCancelDragTransitionEnd',
    ].forEach((handler) => {
      this[handler] = this[handler].bind(this);
    });

    this._onDragStart = event => event.preventDefault();

    this._init();
  }


  /*
  *
  *   initialization
  *
  */


  _init() {
    this._containerElem = this._config.containerSelector;
    // запрещает вызов любых API после вызова destoty({ initialMarkup })
    this._isInit = true;
    // буфер в который помещаются API в ожидании своей очереди
    this._buffer = [];
    this._position = 0;
    this._numberOfSlides = this._containerElem.children.length;
    this._numberSlidesAfterFrame = this._numberOfSlides - this._config.slidesInFrame;
    this._createDomStructure();
    this._eventSubscribe();
  }

  _createDomStructure() {
    this._containerElem.style.overflow = 'hidden';
    this._containerElem.style.position = 'relative';

    // элемент который перемещается внутри containerElem
    this._movingElem = document.createElement('div');
    this._movingElem.style.position = 'relative';
    this._movingElem.style.left = '0';

    if (this._config.draggable) {
      this._setCursorGrab();
    }
    // поместить дочерние элементы из containerElem в movingElem
    for (let i = 0; i < this._numberOfSlides; i += 1) {
      const slideElem = this._containerElem.firstElementChild;
      this._setCssSlideElem(slideElem);
      this._movingElem.appendChild(slideElem);
    }

    // задать ширину элементам
    this._setWidths();
    // удаляет текстовые узлы
    this._containerElem.innerHTML = '';
    this._containerElem.appendChild(this._movingElem);

    // если включено зацикливание, перемещаем последние слайды с конца в начало
    if (this._config.loop) {
      if (this._numberOfSlides - this._config.slidesInFrame < 2) {
        console.warn(`Side-v error: "loop" - for looping need to increase the number of slides by ${2 - (this._numberOfSlides - this._config.slidesInFrame)}`);
      }
      this._relocateSlides({ step: -this._config.step });
    }
  }

  _setCssSlideElem(slideElem) {
    slideElem.style.display = 'inline-block';
    slideElem.setAttribute('data-slide-v-elem', 'slide-elem');
    // добавить класс
    if (this._config.slideElemClass) {
      slideElem.classList.add(this._config.slideElemClass);
    }
  }

  _setWidths() {
    this._movingElem.style.width = `${(100 / this._config.slidesInFrame) * this._numberOfSlides}%`;
    const slideWidth = (100 / this._numberOfSlides);
    for (let i = 0; i < this._numberOfSlides; i += 1) {
      this._movingElem.children[i].style.width = `${slideWidth}%`;
    }
  }

  _setCursorGrab() {
    // это хак, но он работает))
    this._movingElem.style.cursor = '-webkit-grab';
    this._movingElem.style.cursor = '-moz-grab';
    this._movingElem.style.cursor = 'grab';
  }


  /*
  *
  *     API
  *
  */


  getState() {
    return {
      currentSlideIndex: this._position,
      numberSlidesAfterFrame: this._numberSlidesAfterFrame,
      lastSlideIndex: this._numberOfSlides - 1,
    };
  }


  next({ step = this._config.step, isAnimated = true, callback } = {}) {
    this._initApi({
      method: this._takeStep,
      options: { step, isAnimated, callback },
    });
    return this;
  }


  prev({ step = this._config.step, isAnimated = true, callback } = {}) {
    this._initApi({
      method: this._takeStep,
      options: { step: -step, isAnimated, callback },
    });
    return this;
  }


  goTo(position = 0, { isAnimated = true, callback } = {}) {
    this._initApi({
      method: this._goToPosition,
      options: { position, isAnimated, callback },
    });
    return this;
  }


  append(slideElem, { callback } = {}) {
    this._initApi({
      method: this._insertAppend,
      options: { slideElem, callback },
    });
    return this;
  }


  prepend(slideElem, { callback } = {}) {
    this._initApi({
      method: this._insertPrepend,
      options: { slideElem, callback },
    });
    return this;
  }


  insert(slideElem, index, { callback } = {}) {
    this._initApi({
      method: this._insertBeforeSlideElem,
      options: { slideElem, index, callback },
    });
    return this;
  }


  remove(index, { callback } = {}) {
    this._initApi({
      method: this._removeSlideElem,
      options: { index, callback },
    });
    return this;
  }


  destroy({ initialMarkup, callback } = {}) {
    this._initApi({
      method: this._deactivation,
      options: { initialMarkup, callback },
    });
    return this;
  }


  _initApi({ method, options }) {
    // запрещает использование API после destroy()
    if (!this._isInit) {
      return;
    }
    // если был создан callbackBuffer, поместить внего API. Временный callbackBuffer создается при вызове колбека.
    if (this._callbackBuffer) {
      this._callbackBuffer.push(method.bind(this, options));
      return;
    }
    // если карусель находится в движении(асинхронный процесс), поместить API в буфер
    if (this._inMovingProgress) {
      this._buffer.push(method.bind(this, options));
      return;
    }
    // вызвать API не помещая в буфер
    method.call(this, options);
  }


  /*
  *
  *   Перемещение карусели
  *
  */


  _goToPosition({ position, isAnimated, callback }) {
    const step = position - this._position;
    return this._takeStep({ step, isAnimated, callback });
  }


  _takeStep({ step, isAnimated = true, callback }) {
    this._inMovingProgress = true;
    // устраняет дребезг курсора
    if (this._config.draggable && this._config.transitionDuration > 700) {
      this._movingElem.style.cursor = '';
    }

    this._currentStep = this._getCurrentStep(step);

    if (this._currentStep === 0) {
      this._inMovingProgress = false;
      this._callbackHandler({ callback });
      this._callApiFromBuffer();
      return;
    }

    this._movingElem.style.left = `${this._getNextPositionLeft()}px`;

    this._position += this._currentStep;
    this._numberSlidesAfterFrame += -this._currentStep;

    if (!isAnimated) {
      this._inMovingProgress = false;
      this._movingElem.style.transition = '';
      this._movingElem.style.MozTransition = '';
      this._movingElem.style.webkitTransition = '';
      this._movingElem.style.OTransition = '';
      if (this._config.loop) {
        this._relocateSlides({ step: this._currentStep });
      }
      this._callbackHandler({ callback });
      this._callApiFromBuffer();
      return;
    }
    const transition = `left ${this._config.transitionDuration}ms ${this._config.transitionTiming}`;
    this._movingElem.style.transition = transition;
    this._movingElem.style.MozTransition = transition;
    this._movingElem.style.webkitTransition = transition;
    this._movingElem.style.OTransition = transition;
    // сохраняет колбек в переменную для вызова в обработчике окончания css анимации onTransitionEnd
    this._callback = callback;
  }

  _getCurrentStep(step) {
    // доступное количество слайдов для перемещения
    const availableStep = (Math.sign(step) === 1)
      ? this._numberSlidesAfterFrame
      : this._position;
    return (Math.abs(step) < availableStep)
      ? step
      : availableStep * Math.sign(step);
  }

  _getNextPositionLeft() {
    // clientWidth и offsetWidth не точно измеряют. Накапливается ошибка.
    const currentSlideWidth = parseFloat(getComputedStyle(this._movingElem.firstElementChild).width);
    // необходимо для onResize
    this._lastSlideWidth = currentSlideWidth;
    return -(this._position + this._currentStep) * currentSlideWidth;
  }


  // Обработчик события окончания css анимации
  _onTransitionEnd() {
    this._inMovingProgress = false;

    if (this._config.loop) {
      this._relocateSlides({ step: this._currentStep });
    }

    if (this._config.draggable && this._config.transitionDuration > 700) {
      this._setCursorGrab();
    }

    this._config.onMoveEnd();
    this._callbackHandler({ callback: this._callback });
    this._callApiFromBuffer();
  }


  /*
  *
  *    Infinity Loop
  *
  */


  // перебрасывает слайды слева-направо и наоборот
  _relocateSlides({ step }) {
    const direction = Math.sign(step);

    // количество доступных шагов без учета переносимых слайдов
    const availableStep = (direction === 1)
      ? this._numberSlidesAfterFrame
      : this._position;

    if (availableStep >= this._config.step) {
      return;
    }
    // отключить loop, необходимо что бы не срабатывал метод _relocateSlides() внутри метода this._takeStep
    this._config.loop = false;

    // количество доступных сдайдов для переноса (с обеих сторон от кадра должно быть одинаковое количество слайдов)
    const availableSlides = (direction === 1)
      ? Math.floor(this._position / 2)
      : Math.floor(this._numberSlidesAfterFrame / 2);

    // количество перебрасываемых слайдов
    const numbersOfRelocatedSlides = (this._config.step <= availableSlides)
      ? this._config.step
      : availableSlides;

    // вспомогательный буфер, нужен для помещения методов в основной буфер
    const tempBuffer = [];

    if (direction === 1) {
      for (let i = 0; i < numbersOfRelocatedSlides; i += 1) {
        const slideElem = this._movingElem.children[i];
        tempBuffer.push(this._insertAppend.bind(this, { slideElem }));
        tempBuffer.push(this._takeStep.bind(this, { step: -1, isAnimated: false }));
      }
    }

    if (direction === -1) {
      for (let i = 0; i < numbersOfRelocatedSlides; i += 1) {
        const slideElem = this._movingElem.children[this._numberOfSlides - 1 - i];
        tempBuffer.push(this._insertPrepend.bind(this, { slideElem }));
        tempBuffer.push(this._takeStep.bind(this, { step: 1, isAnimated: false }));
      }
    }
    // возвращает Loop в исходное состояние(true). Так же эта функция нужна что бы не вызывался следующий метод из основного буфера...
    // метод this._takeStep вызывает вконце следующий метод из основного буфера(в последнем методе this._takeStep вызовется фенкция setLoopTrue)...
    const setLoopTrue = () => {
      this._config.loop = true;
    };
    tempBuffer.push(setLoopTrue.bind(this));
    // добавление методов из tempBuffer в основной буфер
    this._buffer = tempBuffer.concat(this._buffer);
    this._callApiFromBuffer();
  }


  /*
  *
  *   Общие методы
  *
  */


  _callbackHandler({ callback, parameter }) {
    if (typeof callback !== 'function') {
      return;
    }
    // вспомогательный, временный буфер. Необходим для помещения API из callback в основной буфер
    this._callbackBuffer = [];
    // передает параметер в callback
    callback(parameter);
    // добавление API методов из callback в основной буфер
    this._buffer = this._callbackBuffer.concat(this._buffer);
    this._callbackBuffer = null;
    this._callback = null;
  }


  // вызов следующего API из буфера
  _callApiFromBuffer() {
    if (this._buffer.length > 0) {
      const method = this._buffer.shift();
      method();
    }
  }


  /*
  *
  *   Добавление, удаление слайдов
  *
  */


  _insertPrepend({ slideElem, callback }) {
    const lastNumberSlidesInMovingElem = this._numberOfSlides;
    this._movingElem.insertBefore(slideElem, this._movingElem.firstElementChild);
    // проверить добавился ли элемент
    if (lastNumberSlidesInMovingElem + 1 === this._movingElem.children.length) {
      this._numberSlidesAfterFrame += 1;
      this._numberOfSlides += 1;
      this._setCssSlideElem(slideElem);
      this._setWidths();
    }
    this._callbackHandler({ callback });
    this._callApiFromBuffer();
  }


  _insertAppend({ slideElem, callback }) {
    const lastNumberSlidesInMovingElem = this._numberOfSlides;
    this._movingElem.appendChild(slideElem);
    // проверить добавился ли элемент
    if (lastNumberSlidesInMovingElem + 1 === this._movingElem.children.length) {
      this._numberSlidesAfterFrame += 1;
      this._numberOfSlides += 1;
      this._setCssSlideElem(slideElem);
      this._setWidths();
    }
    this._callbackHandler({ callback });
    this._callApiFromBuffer();
  }


  _insertBeforeSlideElem({ slideElem, index, callback }) {
    if (index < 0 || index > this._numberOfSlides - 1) {
      console.warn('slide-V error: slideElem cannot be inserted. This index does not exists');
      this._callbackHandler({ callback });
      this._callApiFromBuffer();
      return;
    }
    const lastNumberSlidesInMovingElem = this._numberOfSlides;
    this._movingElem.insertBefore(slideElem, this._movingElem.children[index]);
    // проверить добавился ли элемент
    if (lastNumberSlidesInMovingElem + 1 === this._movingElem.children.length) {
      this._numberSlidesAfterFrame += 1;
      this._numberOfSlides += 1;
      this._setCssSlideElem(slideElem);
      this._setWidths();
    }
    this._callbackHandler({ callback });
    this._callApiFromBuffer();
  }


  _removeSlideElem({ index, callback }) {
    if (index < 0 || index > this._numberOfSlides - 1) {
      console.warn('slide-V error: slideElem cannot be deleted. This index does not exists');
      this._callbackHandler({ callback });
      this._callApiFromBuffer();
      return;
    }
    this._numberSlidesAfterFrame -= 1;
    this._numberOfSlides -= 1;
    const removedElem = this._movingElem.removeChild(this._movingElem.children[index]);
    this._removeCssSlideElem(removedElem);
    this._setWidths();
    this._callbackHandler({
      callback,
      parameter: removedElem,
    });
    this._callApiFromBuffer();
  }


  /*
  *
  *   Разрушение карусели
  *
  */


  _deactivation({ initialMarkup, callback } = {}) {
    this._isInit = false;
    this._buffer = [];
    this._movingElem.style.cursor = '';
    this._eventUnsubscribe();
    if (initialMarkup) this._destoryDomStructure();
    this._callbackHandler({ callback });
  }


  _destoryDomStructure() {
    for (let i = 0; i < this._numberOfSlides; i += 1) {
      const slideElem = this._movingElem.firstElementChild;
      this._removeCssSlideElem(slideElem);
      this._containerElem.appendChild(slideElem);
    }
    this._containerElem.style.overflow = '';
    this._containerElem.style.position = '';
    this._containerElem.removeChild(this._movingElem);
    this._movingElem = null;
  }


  _removeCssSlideElem(slideElem) {
    slideElem.style.display = '';
    slideElem.style.width = '';
    slideElem.removeAttribute('data-slide-v-elem');
    if (this._config.slideElemClass) {
      slideElem.classList.remove(this._config.slideElemClass);
    }
  }


  /*
  *
  *   Events
  *
  */


  _eventSubscribe() {
    window.addEventListener('resize', this._onResize);
    this._movingElem.addEventListener('transitionend', this._onTransitionEnd);
    this._movingElem.addEventListener('webkitTransitionEnd', this._onTransitionEnd);
    this._movingElem.addEventListener('oTransitionEnd', this._onTransitionEnd);
    this._movingElem.addEventListener('touchstart', this._onTouchStart);
    this._movingElem.addEventListener('touchend', this._onTouchEnd);
    this._movingElem.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mouseup', this._onMouseUp);

    // if (!this._config.draggable) {
    //   // this._containerElem.addEventListener('click', this._onClick);
    //   return;
    // }

    this._containerElem.addEventListener('dragstart', this._onDragStart);


    this._movingElem.addEventListener('touchmove', this._onTouchMove);

    document.addEventListener('mousemove', this._onMouseMove);
    this._movingElem.addEventListener('mouseleave', this._onMouseLeave);
  }


  _eventUnsubscribe() {
    window.removeEventListener('resize', this._onResize);
    this._movingElem.removeEventListener('transitionend', this._onTransitionEnd);
    this._movingElem.removeEventListener('webkitTransitionEnd', this._onTransitionEnd);
    this._movingElem.removeEventListener('oTransitionEnd', this._onTransitionEnd);
    this._movingElem.removeEventListener('touchstart', this._onTouchStart);
    this._movingElem.removeEventListener('touchend', this._onTouchEnd);
    this._movingElem.removeEventListener('mousedown', this._onMouseDown);
    this._movingElem.removeEventListener('touchend', this._onTouchEnd);

    // if (!this._config.draggable) {
    //   // this._containerElem.removeEventListener('click', this._onClick);
    //   return;
    // }

    this._containerElem.removeEventListener('dragstart', this._onDragStart);

    this._movingElem.removeEventListener('touchmove', this._onTouchMove);

    document.removeEventListener('mousemove', this._onMouseMove);
    this._movingElem.removeEventListener('mouseleave', this._onMouseLeave);
    document.removeEventListener('mouseup', this._onMouseUp);
  }


  /*
  *
  *   Drag & drop, onClick event
  *
  */

  _onClick(e) {
    const slide = e.target.closest('.slide');
    if (!slide) {
      return;
    }
    if (!this._containerElem.contains(slide)) {
      return;
    }
    if (this._isTouchDown) {
      this._isTouchDown = false;
      return;
    }
    this._config.onSlideClick({ slide, target: e.target });
  }


  _onMouseDown(event) {
    if (this._inMovingProgress || event.which !== 1) return;
    this._isMouseDown = true;
    this._dragShiftX = 0;
    this._dragShiftY = 0;
    this._clickX = event.clientX;
    this._clickY = event.clientY;
    this._startDragPos = parseFloat(this._movingElem.style.left);
    if (this._config.draggable) {
      this._movingElem.style.cursor = '-webkit-grabbing';
      this._movingElem.style.cursor = '-moz-grabbing';
      this._movingElem.style.cursor = 'grabbing';
    }
  }

  _onTouchStart(event) {
    // отменяет mousedown(через 300мс) для события touchstart
    // event.preventDefault();
    this._dragShiftX = 0;
    this._dragShiftY = 0;
    if (this._inMovingProgress) return;
    this._isTouchDown = true;
    this._touchX = event.changedTouches[0].pageX;
    this._touchY = event.changedTouches[0].pageY;
    this._startDragPos = parseFloat(this._movingElem.style.left);
  }

  _onMouseMove(event) {
    if (!this._isMouseDown) return;
    this._dragShiftX = this._clickX - event.clientX;
    this._dragShiftY = this._clickY - event.clientY;
    if (!this._config.draggable) {
      return;
    }
    this._dragMove();
  }

  _onTouchMove(event) {
    if (!this._isTouchDown) return;
    this._dragShiftX = this._touchX - event.changedTouches[0].pageX;
    this._dragShiftY = this._touchY - event.changedTouches[0].pageY;
    if (!this._config.draggable) {
      return;
    }
    this._dragMove();
  }

  // алгоритм перемещения movingElem при перетаскивании
  _dragMove() {
    this._inMovingProgress = true;

    const dragdDirection = Math.sign(this._dragShiftX);

    // не пересчитывать this._currentStep и this._nextPositionLeft для каждого события
    if (this._dragdDirection !== dragdDirection) {
      this._dragdDirection = dragdDirection;
      this._currentStep = this._getCurrentStep(dragdDirection * this._config.step);
      this._nextPositionLeft = this._getNextPositionLeft();
    }

    this._movingElem.style.transition = '';
    this._movingElem.style.MozTransition = '';
    this._movingElem.style.webkitTransition = '';
    this._movingElem.style.OTransition = '';

    // перемещение для начального положения
    if (this._position === 0 && dragdDirection === -1) {
      this._movingElem.style.left = `${this._startDragPos - (this._dragShiftX * 0.1)}px`;
      return;
    }
    // перемещение для конечного положения
    if (this._numberSlidesAfterFrame === 0 && dragdDirection === 1) {
      this._movingElem.style.left = `${this._startDragPos - (this._dragShiftX * 0.1)}px`;
      return;
    }
    // перемещение между начальным и конечным положениями
    const dragShiftCoefficient = Math.abs(this._currentStep / this._config.slidesInFrame);
    this._movingElem.style.left = `${this._startDragPos - (this._dragShiftX * dragShiftCoefficient)}px`;

    // ограничение перемещения если слайд находится в ожидаемом положении
    if (parseFloat(this._movingElem.style.left) < this._nextPositionLeft && dragdDirection === 1) {
      // что бы сработал onTransitionEnd, не доводим до конца на 0.1px
      this._movingElem.style.left = `${this._nextPositionLeft + (dragdDirection * 0.1)}px`;
    }
    if (parseFloat(this._movingElem.style.left) > this._nextPositionLeft && dragdDirection === -1) {
      // что бы сработал onTransitionEnd, не доводим до конца на 0.1px
      this._movingElem.style.left = `${this._nextPositionLeft + (dragdDirection * 0.1)}px`;
    }
  }

  _onMouseLeave(event) {
    if (!this._isMouseDown) return;
    this._isMouseDown = false;
    if (this._config.draggable) {
      this._setCursorGrab();
    }
    this._dragEnd(event.target);
  }

  _onTouchEnd(event) {
    if (!this._isTouchDown) return;
    // if (!this._config.draggable) {
    //   this._isTouchDown = false;
    // }
    this._dragEnd(event.target);
  }

  _onMouseUp(event) {
    if (!this._isMouseDown) return;
    this._isMouseDown = false;
    if (this._config.draggable) {
      this._setCursorGrab();
    }
    if (this._isTouchDown) {
      this._isTouchDown = false;
      return;
    }

    this._dragEnd(event.target);
  }

  // определение клика и перетаскивания. Запуск соответствующих методов
  _dragEnd(clickedElem) {
    this._dragdDirection = null;
    this._inMovingProgress = false;
    // если небыло сдвига или сдвиг меньше 3px - то это клик
    if (Math.abs(this._dragShiftX) < 10 && Math.abs(this._dragShiftY) < 10) {
      const elem = clickedElem.closest('[data-slide-v-elem="slide-elem"]');
      if (elem) this._config.onSlideClick({ slide: elem, target: clickedElem });
    }
    // если был сдвиг
    if (!this._config.draggable) {
      return;
    }
    if (this._dragShiftX > 0 || this._dragShiftX < 0) {
      this._dropMoving();
    }
  }


  // движение при бросании
  _dropMoving() {
    const currentPositionLeft = parseFloat(this._movingElem.style.left);
    // получить метод движения для завершения drag&drop
    const dropMethod = this._getDropMethod();
    dropMethod.call(this);
    this._dragShiftX = 0;

    // ускорение премещения при перетаскивании в зависимости от положения movingElem
    if (dropMethod === this.next || dropMethod === this.prev) {
      const progressDragCoefficient = this._getProgressDragCoefficient(currentPositionLeft);
      const transition = `left ${this._config.transitionDuration - (this._config.transitionDuration * progressDragCoefficient)}ms ${this._config.transitionTiming}`;
      this._movingElem.style.transition = transition;
      this._movingElem.style.MozTransition = transition;
      this._movingElem.style.webkitTransition = transition;
      this._movingElem.style.OTransition = transition;
    }
  }


  // получение метода для бросания
  _getDropMethod() {
    const containerWidth = this._containerElem.clientWidth;
    // -2 нужно что бы работал коефициент dragthreshold = 1
    const threshold = (containerWidth * this._config.dragThreshold) - 2;

    if (this._dragShiftX > threshold && this._numberSlidesAfterFrame !== 0) {
      return this.next;
    }
    if (this._dragShiftX < -threshold && this._position !== 0) {
      return this.prev;
    }
    return this._cancelDrag;
  }


  // коефицеинт премещения при перетаскивании (0 -> 1)
  _getProgressDragCoefficient(currentPositionLeft) {
    const endPositionLeft = this._nextPositionLeft;
    const startPositionLeft = endPositionLeft + (this._currentStep * this._lastSlideWidth);
    return (currentPositionLeft - startPositionLeft) / (endPositionLeft - startPositionLeft);
  }


  // отмена drag & drop
  _cancelDrag() {
    this._inMovingProgress = true;
    this._movingElem.style.transition = 'left 100ms';
    this._movingElem.style.MozTransition = 'left 100ms';
    this._movingElem.style.webkitTransition = 'left 100ms';
    this._movingElem.style.OTransition = 'left 100ms';
    this._movingElem.style.left = `${this._startDragPos}px`;
    // для анимации отмены drag&drop обработчик onTransitionEnd не должен вызываться
    this._movingElem.removeEventListener('transitionend', this._onTransitionEnd);
    this._movingElem.addEventListener('transitionend', this._onCancelDragTransitionEnd);
  }


  // Обработчик события окончания css анимации для отмены drag & drop
  _onCancelDragTransitionEnd() {
    this._inMovingProgress = false;
    this._movingElem.addEventListener('transitionend', this._onTransitionEnd);
    this._movingElem.removeEventListener('transitionend', this._onCancelDragTransitionEnd);
  }


  /*
  *
  *   Resize
  *
  */


  _onResize() {
    if (this._inMovingProgress) {
      this._dynamicAdaptationStructure();
      return;
    }
    this._movingElem.style.transition = '';
    this._movingElem.style.MozTransition = '';
    this._movingElem.style.webkitTransition = '';
    this._movingElem.style.OTransition = '';
    const slideWidth = parseFloat(getComputedStyle(this._movingElem.firstElementChild).width);
    this._movingElem.style.left = `${-this._position * slideWidth}px`;
  }


  // изменение ширины слайдов и положения movingElem в процессе перемещения
  _dynamicAdaptationStructure() {
    const slideWidth = parseFloat(getComputedStyle(this._movingElem.firstElementChild).width);
    // позиция в которую перемещается movingElem
    const endPositionLeft = -(this._position * slideWidth);
    // насколько изменилась ширина слайда по сравнению с последним событием onResize
    const slideWidthCoefficient = slideWidth / this._lastSlideWidth;
    // позиция с которой перемещается movingElem
    const startPositionLeft = endPositionLeft + (this._currentStep * slideWidth);
    // текущая позиция movingElem
    let currentPositionLeft = parseFloat(getComputedStyle(this._movingElem).left);
    // требуемая текущая позиция movingElem c с учетом изменения ширины слайда
    currentPositionLeft *= slideWidthCoefficient;

    // изменение текущего положения movingElem с учетом изменения ширины слайда
    this._movingElem.style.left = `${currentPositionLeft}px`;
    // перемещение в новое положение currentPositionLeft должно быть без анимации
    this._movingElem.style.transition = '';
    this._movingElem.style.MozTransition = '';
    this._movingElem.style.webkitTransition = '';
    this._movingElem.style.OTransition = '';

    // текущий коэфициент прогресса перемещения от startPositionLeft до endPositionLeft
    const progressMovingCoefficient = (endPositionLeft - currentPositionLeft) / (endPositionLeft - startPositionLeft);
    this._lastSlideWidth = slideWidth;
    clearTimeout(this._timerResize); // выполнить только последний setTimeout

    this._timerResize = setTimeout(() => {
      // после корректировки положения movingElem, запускаем анимацию с новым значением transitionDuration и left
      const transition = `left ${this._config.transitionDuration * progressMovingCoefficient}ms ${this._config.transitionTiming}`;
      this._movingElem.style.transition = transition;
      this._movingElem.style.MozTransition = transition;
      this._movingElem.style.webkitTransition = transition;
      this._movingElem.style.OTransition = transition;
      this._movingElem.style.left = `${endPositionLeft}px`;
    }, 50);
  }
}
