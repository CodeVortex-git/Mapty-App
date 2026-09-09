'use strict';

// ==================== CONSTANTS ====================

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MAP_CONFIG = {
  tileUrl:
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
  attribution:
    'Tiles &copy; Esri &mdash; Source: Esri, OpenStreetMap contributors, and the GIS User Community',
  defaultZoom: 13,
};

const POPUP_CONFIG = {
  maxWidth: 250,
  minWidth: 100,
  autoClose: false,
  closeOnClick: false,
};

const WORKOUT_ICONS = {
  running: '🏃‍♂️',
  cycling: '🚴‍♀️',
  timer: '⏱',
  pace: '⚡️',
  cadence: '🦶🏼',
  elevation: '⛰',
};

const FORM_INPUTS = {
  type: '.form__input--type',
  distance: '.form__input--distance',
  duration: '.form__input--duration',
  cadence: '.form__input--cadence',
  elevation: '.form__input--elevation',
};

// ==================== DOM SELECTORS ====================

const selectors = {
  form: document.querySelector('.form'),
  containerWorkouts: document.querySelector('.workouts'),
  inputType: document.querySelector(FORM_INPUTS.type),
  inputDistance: document.querySelector(FORM_INPUTS.distance),
  inputDuration: document.querySelector(FORM_INPUTS.duration),
  inputCadence: document.querySelector(FORM_INPUTS.cadence),
  inputElevation: document.querySelector(FORM_INPUTS.elevation),
};

// ==================== WORKOUT CLASSES ====================

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);

  constructor(coords, distance, duration) {
    this.coords = coords;
    this.distance = distance;
    this.duration = duration;
  }

  _setDescription() {
    const typeName = this.type[0].toUpperCase() + this.type.slice(1);
    this.description = `${typeName} on ${months[this.date.getMonth()]} ${this.date.getDate()}`;
  }

  getIcon() {
    return WORKOUT_ICONS[this.type];
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

// ==================== VALIDATION HELPERS ====================

const Validators = {
  isValidNumber(...inputs) {
    return inputs.every(inp => Number.isFinite(inp));
  },

  isAllPositive(...inputs) {
    return inputs.every(inp => inp > 0);
  },

  validateRunning(distance, duration, cadence) {
    if (
      !this.isValidNumber(distance, duration, cadence) ||
      !this.isAllPositive(distance, duration, cadence)
    ) {
      return 'Distance, duration, and cadence must be positive numbers';
    }
    return null;
  },

  validateCycling(distance, duration, elevationGain) {
    if (
      !this.isValidNumber(distance, duration, elevationGain) ||
      !this.isAllPositive(distance, duration)
    ) {
      return 'Distance and duration must be positive numbers';
    }
    return null;
  },
};

// ==================== WORKOUT RENDERER ====================

const WorkoutRenderer = {
  getCommonHTML(workout) {
    return `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__details">
          <span class="workout__icon">${workout.getIcon()}</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">${WORKOUT_ICONS.timer}</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;
  },

  getRunningHTML(workout) {
    return `
      <div class="workout__details">
        <span class="workout__icon">${WORKOUT_ICONS.pace}</span>
        <span class="workout__value">${workout.pace.toFixed(1)}</span>
        <span class="workout__unit">min/km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">${WORKOUT_ICONS.cadence}</span>
        <span class="workout__value">${workout.cadence}</span>
        <span class="workout__unit">spm</span>
      </div>
    </li>`;
  },

  getCyclingHTML(workout) {
    return `
      <div class="workout__details">
        <span class="workout__icon">${WORKOUT_ICONS.pace}</span>
        <span class="workout__value">${workout.speed.toFixed(1)}</span>
        <span class="workout__unit">km/h</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">${WORKOUT_ICONS.elevation}</span>
        <span class="workout__value">${workout.elevationGain}</span>
        <span class="workout__unit">m</span>
      </div>
    </li>`;
  },

  render(workout) {
    let html = this.getCommonHTML(workout);
    html +=
      workout.type === 'running'
        ? this.getRunningHTML(workout)
        : this.getCyclingHTML(workout);
    return html;
  },
};

// ==================== APP CLASS ====================

class App {
  #map;
  #mapEvent;
  #pendingMarker;
  #workouts = [];

  constructor() {
    this._initializeEventListeners();
    this._getPosition();
  }

  _initializeEventListeners() {
    selectors.inputType.addEventListener(
      'change',
      this._toggleElevationField.bind(this),
    );
    selectors.form.addEventListener('submit', this._newWorkout.bind(this));
  }

  _getPosition() {
    const fallbackPosition = {
      coords: {
        latitude: 40.7128,
        longitude: -74.006,
      },
    };

    if (!navigator.geolocation) {
      this._loadMap(fallbackPosition);
      return;
    }

    navigator.geolocation.getCurrentPosition(this._loadMap.bind(this), () =>
      this._loadMap(fallbackPosition),
    );
  }

  _loadMap(position) {
    const { latitude, longitude } = position.coords;
    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, MAP_CONFIG.defaultZoom);

    L.tileLayer(MAP_CONFIG.tileUrl, {
      attribution: MAP_CONFIG.attribution,
    }).addTo(this.#map);

    this.#map.on('click', this._showForm.bind(this));
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;

    if (this.#pendingMarker) {
      this.#map.removeLayer(this.#pendingMarker);
    }

    this.#pendingMarker = L.marker(mapE.latlng).addTo(this.#map);
    selectors.form.classList.remove('hidden');
    selectors.inputDistance.focus();
  }

  _hideForm() {
    selectors.inputDistance.value = '';
    selectors.inputDuration.value = '';
    selectors.inputCadence.value = '';
    selectors.inputElevation.value = '';
    selectors.form.classList.add('hidden');
  }

  _toggleElevationField() {
    selectors.inputElevation
      .closest('.form__row')
      .classList.toggle('form__row--hidden');
    selectors.inputCadence
      .closest('.form__row')
      .classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    e.preventDefault();

    const type = selectors.inputType.value;
    const distance = +selectors.inputDistance.value;
    const duration = +selectors.inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;

    let workout;
    let validationError;

    if (type === 'running') {
      const cadence = +selectors.inputCadence.value;
      validationError = Validators.validateRunning(distance, duration, cadence);
      if (validationError) {
        this._showError(validationError);
        return;
      }
      workout = new Running([lat, lng], distance, duration, cadence);
    }

    if (type === 'cycling') {
      const elevation = +selectors.inputElevation.value;
      validationError = Validators.validateCycling(
        distance,
        duration,
        elevation,
      );
      if (validationError) {
        this._showError(validationError);
        return;
      }
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    this.#workouts.push(workout);

    if (this.#pendingMarker) {
      this.#map.removeLayer(this.#pendingMarker);
      this.#pendingMarker = null;
    }

    this._renderWorkoutMarker(workout);
    this._renderWorkout(workout);
    this._hideForm();
  }

  _renderWorkoutMarker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          ...POPUP_CONFIG,
          className: `workout-popup workout-popup--${workout.type}`,
        }),
      )
      .setPopupContent(`${workout.getIcon()} ${workout.description}`)
      .openPopup();
  }

  _renderWorkout(workout) {
    const html = WorkoutRenderer.render(workout);
    selectors.containerWorkouts.insertAdjacentHTML('beforeend', html);
  }

  _showError(message) {
    alert(message);
  }
}

// ==================== INITIALIZE APP ====================

const app = new App();
