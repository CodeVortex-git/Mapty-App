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
  searchUrl: 'https://nominatim.openstreetmap.org/search',
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

const STORAGE_KEY = 'mapty-workouts';

const API_CONFIG = {
  weatherUrl: 'https://api.open-meteo.com/v1/forecast',
  archiveWeatherUrl: 'https://archive-api.open-meteo.com/v1/archive',
  geocodingUrl: 'https://api.bigdatacloud.net/data/reverse-geocode-client',
  searchUrl: 'https://photon.komoot.io/api/',
  requestTimeout: 10000,
};

const WEATHER_DESCRIPTIONS = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

const WEATHER_ICONS = {
  0: '☀️',
  1: '🌤️',
  2: '⛅',
  3: '☁️',
  45: '🌫️',
  48: '🌫️',
  51: '🌦️',
  53: '🌦️',
  55: '🌧️',
  61: '🌧️',
  63: '🌧️',
  65: '🌧️',
  71: '🌨️',
  73: '🌨️',
  75: '❄️',
  80: '🌦️',
  81: '🌧️',
  82: '⛈️',
  95: '⛈️',
  96: '⛈️',
  99: '⛈️',
};

// ==================== DOM SELECTORS ====================

const selectors = {
  form: document.querySelector('.form'),
  containerWorkouts: document.querySelector('.workouts'),
  workoutControls: document.querySelector('.workout-controls'),
  sortWorkouts: document.querySelector('.sort-select'),
  deleteAll: document.querySelector('.delete-all-btn'),
  message: document.querySelector('.message'),
  formButton: document.querySelector('.form__btn'),
  formCancel: document.querySelector('.form__cancel'),
  inputType: document.querySelector(FORM_INPUTS.type),
  inputDistance: document.querySelector(FORM_INPUTS.distance),
  inputDuration: document.querySelector(FORM_INPUTS.duration),
  inputCadence: document.querySelector(FORM_INPUTS.cadence),
  inputElevation: document.querySelector(FORM_INPUTS.elevation),
  searchForm: document.querySelector('.map-search-form'),
  searchInput: document.querySelector('.map-search-input'),
  searchClear: document.querySelector('.map-search-clear'),
  searchResults: document.querySelector('.map-search-results'),
  findLocation: document.querySelector('.find-location-button'),
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

const formatDateForApi = date => date.toISOString().slice(0, 10);

const isValidCoordinates = coords =>
  Array.isArray(coords) &&
  coords.length === 2 &&
  Number.isFinite(Number(coords[0])) &&
  Number.isFinite(Number(coords[1])) &&
  Number(coords[0]) >= -90 &&
  Number(coords[0]) <= 90 &&
  Number(coords[1]) >= -180 &&
  Number(coords[1]) <= 180;

const escapeHTML = value =>
  String(value).replace(
    /[&<>'"]/g,
    character =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[character],
  );

const fetchJSON = async url => {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    API_CONFIG.requestTimeout,
  );

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) throw new Error(`Request failed with ${response.status}`);

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
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
      <div class="workout__actions">
        <button type="button" class="workout__action workout__action--edit">Edit</button>
        <button type="button" class="workout__action workout__action--delete">Delete</button>
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
      <div class="workout__actions">
        <button type="button" class="workout__action workout__action--edit">Edit</button>
        <button type="button" class="workout__action workout__action--delete">Delete</button>
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
  #markers = new Map();
  #editingWorkoutId = null;
  #searchMarker;
  #currentLocationMarker;
  #currentLocationAccuracy;
  #searchRequestId = 0;

  constructor() {
    this._loadWorkouts();
    this._initializeEventListeners();
    this._getPosition();
  }

  _loadWorkouts() {
    const savedWorkouts = localStorage.getItem(STORAGE_KEY);

    if (!savedWorkouts) return;

    try {
      const workouts = JSON.parse(savedWorkouts);

      this.#workouts = workouts.map(workoutData => {
        const workout =
          workoutData.type === 'running'
            ? new Running(
                workoutData.coords,
                workoutData.distance,
                workoutData.duration,
                workoutData.cadence,
              )
            : new Cycling(
                workoutData.coords,
                workoutData.distance,
                workoutData.duration,
                workoutData.elevationGain,
              );

        workout.id = workoutData.id;
        workout.date = new Date(workoutData.date);
        workout.location = workoutData.location;
        workout.weather = workoutData.weather;
        workout._setDescription();
        return workout;
      });
    } catch (error) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  _persistWorkouts() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.#workouts));
      return true;
    } catch (error) {
      this._showError('Could not save your workout changes.');
      return false;
    }
  }

  _initializeEventListeners() {
    selectors.inputType.addEventListener(
      'change',
      this._toggleElevationField.bind(this),
    );
    selectors.form.addEventListener('submit', this._newWorkout.bind(this));
    selectors.formCancel.addEventListener('click', this._cancelForm.bind(this));
    selectors.sortWorkouts.addEventListener(
      'change',
      this._sortWorkouts.bind(this),
    );
    selectors.deleteAll.addEventListener(
      'click',
      this._deleteAllWorkouts.bind(this),
    );
    selectors.containerWorkouts.addEventListener(
      'click',
      this._moveToWorkout.bind(this),
    );
    selectors.searchForm.addEventListener(
      'submit',
      this._searchLocation.bind(this),
    );
    selectors.searchClear.addEventListener(
      'click',
      this._clearLocationSearch.bind(this),
    );
    selectors.searchResults.addEventListener(
      'click',
      this._selectSearchResult.bind(this),
    );
    selectors.findLocation.addEventListener(
      'click',
      this._findCurrentLocation.bind(this),
    );
  }

  _moveToWorkout(e) {
    const workoutElement = e.target.closest('.workout');

    if (!workoutElement) return;

    const workout = this.#workouts.find(
      workout => workout.id === workoutElement.dataset.id,
    );

    if (!workout) return;

    if (e.target.closest('.workout__action--edit')) {
      e.stopPropagation();
      this._showEditForm(workout);
      return;
    }

    if (e.target.closest('.workout__action--delete')) {
      e.stopPropagation();
      this._deleteWorkout(workout.id);
      return;
    }

    this.#map.setView(workout.coords, MAP_CONFIG.defaultZoom, {
      animate: true,
      duration: 1,
    });
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

    this.#workouts.forEach(workout => {
      this._renderWorkoutMarker(workout);
    });
    this._renderWorkouts();

    this.#map.on('click', this._showForm.bind(this));

    this.#workouts
      .filter(workout => !workout.location || !workout.weather)
      .reduce(
        (promise, workout) => promise.then(() => this._enrichWorkout(workout)),
        Promise.resolve(),
      );
  }

  async _searchLocation(e) {
    e.preventDefault();
    const query = selectors.searchInput.value.trim();

    if (!query) {
      this._showMessage('Enter a place to search.');
      return;
    }

    const requestId = ++this.#searchRequestId;
    selectors.searchResults.textContent = 'Searching...';

    try {
      const url = new URL(API_CONFIG.searchUrl);
      url.search = new URLSearchParams({ q: query, limit: '5' });
      const data = await fetchJSON(url);
      const results = Array.isArray(data.features)
        ? data.features
            .map(result => ({
              lat: result.geometry?.coordinates?.[1],
              lon: result.geometry?.coordinates?.[0],
              display_name: this._getSearchResultName(result, query),
            }))
            .filter(result => result.display_name)
        : [];

      if (requestId !== this.#searchRequestId) return;
      if (!Array.isArray(results) || !results.length) {
        selectors.searchResults.textContent = '';
        this._showError('No matching locations were found.');
        return;
      }

      selectors.searchResults.innerHTML = results
        .filter(result => isValidCoordinates([result.lat, result.lon]))
        .map(
          result => `
            <button type="button" class="map-search-result" role="option"
              data-lat="${escapeHTML(result.lat)}"
              data-lon="${escapeHTML(result.lon)}"
              data-name="${escapeHTML(result.display_name || query)}">
              ${escapeHTML(result.display_name || query)}
            </button>`,
        )
        .join('');

      if (!selectors.searchResults.innerHTML) {
        this._showError('The search returned invalid location data.');
      }
    } catch (error) {
      if (requestId !== this.#searchRequestId) return;
      selectors.searchResults.textContent = '';
      this._showError(
        'Location search is unavailable right now. Please try again later.',
      );
    }
  }

  _getSearchResultName(result, fallback) {
    const properties = result.properties || {};
    return (
      [
        properties.name,
        properties.street,
        properties.city || properties.locality,
        properties.state,
        properties.country,
      ]
        .filter(Boolean)
        .filter((value, index, values) => values.indexOf(value) === index)
        .join(', ') || fallback
    );
  }

  _selectSearchResult(e) {
    const result = e.target.closest('.map-search-result');
    if (!result) return;

    const lat = Number(result.dataset.lat);
    const lon = Number(result.dataset.lon);
    if (!isValidCoordinates([lat, lon])) {
      this._showError('That search result has invalid coordinates.');
      return;
    }

    this.#map.setView([lat, lon], 14, { animate: true, duration: 1 });
    this._showSearchMarker([lat, lon], result.dataset.name);
    selectors.searchInput.value = result.dataset.name;
    selectors.searchResults.textContent = '';
    selectors.searchClear.classList.remove('hidden');
  }

  _showSearchMarker(coords, name) {
    if (this.#searchMarker) this.#map.removeLayer(this.#searchMarker);

    this.#searchMarker = L.circleMarker(coords, {
      radius: 9,
      color: '#2563eb',
      fillColor: '#60a5fa',
      fillOpacity: 0.9,
      weight: 3,
    })
      .addTo(this.#map)
      .bindPopup(`<strong>${escapeHTML(name)}</strong>`)
      .openPopup();
  }

  _clearLocationSearch() {
    this.#searchRequestId += 1;
    selectors.searchInput.value = '';
    selectors.searchResults.textContent = '';
    selectors.searchClear.classList.add('hidden');
    if (this.#searchMarker) {
      this.#map.removeLayer(this.#searchMarker);
      this.#searchMarker = null;
    }
  }

  _findCurrentLocation() {
    if (!navigator.geolocation) {
      this._showError('Your browser does not support location services.');
      return;
    }

    selectors.findLocation.disabled = true;
    selectors.findLocation.textContent = 'Finding location...';
    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude, accuracy } = position.coords;
        const coords = [latitude, longitude];
        this.#map.setView(coords, 15, { animate: true, duration: 1 });

        if (this.#currentLocationMarker) {
          this.#map.removeLayer(this.#currentLocationMarker);
        }
        if (this.#currentLocationAccuracy) {
          this.#map.removeLayer(this.#currentLocationAccuracy);
        }

        this.#currentLocationMarker = L.circleMarker(coords, {
          radius: 8,
          color: '#ffffff',
          fillColor: '#2563eb',
          fillOpacity: 1,
          weight: 3,
        })
          .addTo(this.#map)
          .bindPopup('Your current location')
          .openPopup();
        this.#currentLocationAccuracy = L.circle(coords, {
          radius: accuracy,
          color: '#2563eb',
          fillColor: '#60a5fa',
          fillOpacity: 0.15,
          weight: 1,
        }).addTo(this.#map);
        this._showMessage('Current location updated.');
        this._resetFindLocationButton();
      },
      error => {
        const messages = {
          1: 'Location permission was denied. Allow access to find your location.',
          2: 'Your current location is unavailable right now.',
          3: 'Finding your location timed out. Please try again.',
        };
        this._showError(
          messages[error.code] || 'Could not find your location.',
        );
        this._resetFindLocationButton();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }

  _resetFindLocationButton() {
    selectors.findLocation.disabled = false;
    selectors.findLocation.textContent = 'Find my location';
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    this.#editingWorkoutId = null;
    selectors.formButton.textContent = 'Save workout';

    if (this.#pendingMarker) {
      this.#map.removeLayer(this.#pendingMarker);
    }

    this.#pendingMarker = L.marker(mapE.latlng).addTo(this.#map);
    selectors.form.classList.remove('hidden');
    selectors.inputDistance.focus();
  }

  _showEditForm(workout) {
    this.#editingWorkoutId = workout.id;
    selectors.inputType.value = workout.type;
    selectors.inputDistance.value = workout.distance;
    selectors.inputDuration.value = workout.duration;
    selectors.inputCadence.value = workout.cadence || '';
    selectors.inputElevation.value = workout.elevationGain || '';
    selectors.formButton.textContent = 'Update workout';
    this._updateFormFields();
    selectors.form.classList.remove('hidden');
    selectors.inputDistance.focus();
  }

  _cancelForm() {
    if (this.#pendingMarker) {
      this.#map.removeLayer(this.#pendingMarker);
      this.#pendingMarker = null;
    }
    this.#editingWorkoutId = null;
    selectors.formButton.textContent = 'Save workout';
    this._hideForm();
  }

  _hideForm() {
    selectors.inputDistance.value = '';
    selectors.inputDuration.value = '';
    selectors.inputCadence.value = '';
    selectors.inputElevation.value = '';
    selectors.form.classList.add('hidden');
  }

  _toggleElevationField() {
    this._updateFormFields();
  }

  _updateFormFields() {
    const isRunning = selectors.inputType.value === 'running';
    selectors.inputElevation
      .closest('.form__row')
      .classList.toggle('form__row--hidden', isRunning);
    selectors.inputCadence
      .closest('.form__row')
      .classList.toggle('form__row--hidden', !isRunning);
  }

  _newWorkout(e) {
    e.preventDefault();

    const type = selectors.inputType.value;
    const distance = +selectors.inputDistance.value;
    const duration = +selectors.inputDuration.value;
    let validationError;
    let workout;

    if (type === 'running') {
      const cadence = +selectors.inputCadence.value;
      validationError = Validators.validateRunning(distance, duration, cadence);
      if (validationError) {
        this._showError(validationError);
        return;
      }
      workout = new Running(
        this.#editingWorkoutId
          ? this.#workouts.find(item => item.id === this.#editingWorkoutId)
              .coords
          : [this.#mapEvent.latlng.lat, this.#mapEvent.latlng.lng],
        distance,
        duration,
        cadence,
      );
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
      workout = new Cycling(
        this.#editingWorkoutId
          ? this.#workouts.find(item => item.id === this.#editingWorkoutId)
              .coords
          : [this.#mapEvent.latlng.lat, this.#mapEvent.latlng.lng],
        distance,
        duration,
        elevation,
      );
    }

    if (!workout) {
      this._showError('Please choose a valid workout type.');
      return;
    }

    if (this.#editingWorkoutId) {
      const workoutIndex = this.#workouts.findIndex(
        item => item.id === this.#editingWorkoutId,
      );
      const oldWorkout = this.#workouts[workoutIndex];

      if (workoutIndex === -1 || !oldWorkout) {
        this._showError('That workout could not be found.');
        return;
      }

      workout.id = oldWorkout.id;
      workout.date = oldWorkout.date;
      workout.location = oldWorkout.location;
      workout.weather = oldWorkout.weather;
      workout._setDescription();
      this.#workouts[workoutIndex] = workout;
      this._updateWorkoutMarker(workout);
      this._persistWorkouts();
      this._renderWorkouts();
      this._cancelForm();
      this._showMessage('Workout updated successfully.');
      return;
    }

    this.#workouts.push(workout);
    this._persistWorkouts();

    if (this.#pendingMarker) {
      this.#map.removeLayer(this.#pendingMarker);
      this.#pendingMarker = null;
    }

    this._renderWorkoutMarker(workout, true);
    this._renderWorkouts();
    this._hideForm();
    this._showMessage('Workout saved successfully.');
    this._enrichWorkout(workout);
  }

  _renderWorkoutMarker(workout, openPopup = false) {
    const popup = L.popup({
      ...POPUP_CONFIG,
      className: `workout-popup workout-popup--${workout.type}`,
    }).setContent(this._getPopupContent(workout));
    const marker = L.marker(workout.coords).addTo(this.#map).bindPopup(popup);

    this.#markers.set(workout.id, marker);

    if (openPopup) marker.openPopup();
  }

  _updateWorkoutMarker(workout) {
    const marker = this.#markers.get(workout.id);

    if (marker) this.#map.removeLayer(marker);
    this._renderWorkoutMarker(workout);
  }

  _getPopupContent(workout) {
    const location = workout.location || 'Location unavailable';
    const weather = workout.weather;

    if (!weather) {
      return `${workout.getIcon()} ${escapeHTML(workout.description)}<br><br>${escapeHTML(location)}<br><br>Weather unavailable`;
    }

    return `${workout.getIcon()} ${escapeHTML(workout.description)}<br><br>
      ${escapeHTML(location)}<br>
      ${weather.icon} ${escapeHTML(weather.description)}<br>
      Temperature: ${weather.temperature}&deg;C<br>
      Wind: ${weather.windSpeed} km/h<br>
      Humidity: ${weather.humidity}%`;
  }

  async _enrichWorkout(workout) {
    if (!isValidCoordinates(workout.coords)) {
      this._showError(
        'Weather and location are unavailable for invalid coordinates.',
      );
      return;
    }

    const results = await Promise.allSettled([
      workout.location
        ? Promise.resolve(workout.location)
        : this._getLocation(workout.coords),
      workout.weather
        ? Promise.resolve(workout.weather)
        : this._getWeather(workout),
    ]);
    const currentWorkout = this.#workouts.find(item => item.id === workout.id);
    if (!currentWorkout) return;

    let changed = false;

    if (results[0].status === 'fulfilled' && results[0].value) {
      currentWorkout.location = results[0].value;
      changed = true;
    }

    if (results[1].status === 'fulfilled' && results[1].value) {
      currentWorkout.weather = results[1].value;
      changed = true;
    }

    if (changed) {
      this._persistWorkouts();
      this._updateWorkoutMarkerPopup(currentWorkout);
      this._renderWorkouts();
    }

    const failedServices = results
      .map((result, index) => (result.status === 'rejected' ? index : null))
      .filter(index => index !== null)
      .map(index => (index === 0 ? 'location' : 'weather'));

    if (failedServices.length) {
      this._showMessage(
        `${failedServices.join(' and ')} information is currently unavailable.`,
      );
    }
  }

  async _getLocation(coords) {
    const url = new URL(API_CONFIG.geocodingUrl);
    url.search = new URLSearchParams({
      latitude: coords[0],
      longitude: coords[1],
      localityLanguage: 'en',
    });
    const data = await fetchJSON(url);
    const location = [
      data.city || data.locality,
      data.principalSubdivision,
      data.countryName,
    ]
      .filter(Boolean)
      .join(', ');

    if (!location) throw new Error('Location not found');
    return location;
  }

  async _getWeather(workout) {
    const date = new Date(workout.date);
    if (Number.isNaN(date.getTime())) throw new Error('Invalid workout date');

    const today = new Date();
    const archiveCutoff = new Date(today);
    archiveCutoff.setUTCDate(archiveCutoff.getUTCDate() - 5);
    const endpoint =
      date < archiveCutoff
        ? API_CONFIG.archiveWeatherUrl
        : API_CONFIG.weatherUrl;
    const url = new URL(endpoint);
    const dateString = formatDateForApi(date);
    url.search = new URLSearchParams({
      latitude: workout.coords[0],
      longitude: workout.coords[1],
      start_date: dateString,
      end_date: dateString,
      hourly: 'temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m',
      timezone: 'UTC',
      temperature_unit: 'celsius',
      wind_speed_unit: 'kmh',
    });
    const data = await fetchJSON(url);

    if (!data.hourly || !data.hourly.time?.length) {
      throw new Error('Weather history unavailable');
    }

    const hourIndex = data.hourly.time.reduce((closestIndex, time, index) => {
      const closestDifference = Math.abs(
        new Date(data.hourly.time[closestIndex]).getTime() - date.getTime(),
      );
      const difference = Math.abs(new Date(time).getTime() - date.getTime());
      return difference < closestDifference ? index : closestIndex;
    }, 0);
    const weatherCode = data.hourly.weather_code[hourIndex];

    return {
      temperature: Math.round(data.hourly.temperature_2m[hourIndex] * 10) / 10,
      description: WEATHER_DESCRIPTIONS[weatherCode] || 'Unknown conditions',
      icon: WEATHER_ICONS[weatherCode] || '🌡️',
      windSpeed: Math.round(data.hourly.wind_speed_10m[hourIndex] * 10) / 10,
      humidity: data.hourly.relative_humidity_2m[hourIndex],
    };
  }

  _updateWorkoutMarkerPopup(workout) {
    const marker = this.#markers.get(workout.id);
    if (marker && marker.getPopup()) {
      marker.getPopup().setContent(this._getPopupContent(workout));
    }
  }

  _renderWorkouts() {
    selectors.containerWorkouts
      .querySelectorAll('.workout')
      .forEach(workoutElement => workoutElement.remove());

    this.#workouts.forEach(workout => {
      const html = WorkoutRenderer.render(workout);
      selectors.containerWorkouts.insertAdjacentHTML('beforeend', html);
    });
  }

  _deleteWorkout(workoutId) {
    const workout = this.#workouts.find(item => item.id === workoutId);

    if (!workout) {
      this._showError('That workout could not be found.');
      return;
    }

    if (!window.confirm(`Delete ${workout.description}?`)) return;

    const marker = this.#markers.get(workoutId);
    if (marker) {
      this.#map.removeLayer(marker);
      this.#markers.delete(workoutId);
    }

    this.#workouts = this.#workouts.filter(item => item.id !== workoutId);
    this._persistWorkouts();
    this._renderWorkouts();
    this._showMessage('Workout deleted.');
  }

  _deleteAllWorkouts() {
    if (!this.#workouts.length) {
      this._showMessage('There are no workouts to delete.');
      return;
    }

    if (!window.confirm('Delete all saved workouts?')) return;

    this.#markers.forEach(marker => this.#map.removeLayer(marker));
    this.#markers.clear();
    this.#workouts = [];
    localStorage.removeItem(STORAGE_KEY);
    this._renderWorkouts();
    this._showMessage('All workouts deleted.');
  }

  _sortWorkouts() {
    const sortBy = selectors.sortWorkouts.value;

    this.#workouts.sort((firstWorkout, secondWorkout) => {
      if (sortBy === 'type') {
        return firstWorkout.type.localeCompare(secondWorkout.type);
      }

      if (sortBy === 'date') {
        return secondWorkout.date - firstWorkout.date;
      }

      const firstValue = Number.isFinite(firstWorkout[sortBy])
        ? firstWorkout[sortBy]
        : -Infinity;
      const secondValue = Number.isFinite(secondWorkout[sortBy])
        ? secondWorkout[sortBy]
        : -Infinity;

      return secondValue - firstValue;
    });

    this._persistWorkouts();
    this._renderWorkouts();
  }

  _showMessage(message) {
    selectors.message.textContent = message;
  }

  _showError(message) {
    selectors.message.textContent = `Error: ${message}`;
  }
}

// ==================== INITIALIZE APP ====================

const app = new App();
