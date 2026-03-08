'use strict';

// prettier-ignore
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

if (navigator.geolocation)
  navigator.geolocation.getCurrentPosition(
    position => {
      const { latitude } = position.coords;
      const { longitude } = position.coords;
      console.log(position);
      console.log(`https://www.google.com/maps/@${latitude}, ${longitude}`);

      const coords = [latitude, longitude];
      const map = L.map('map').setView(coords, 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      let marker; //Creates the marker variable to store the current click location

      map.on('click', e => {
        const { lat, lng } = e.latlng;
        map.panTo([lat, lng]); // Always pans to the marker location

        L.marker([lat, lng])
          .addTo(map)
          .bindPopup('Workout', { autoClose: false, closeOnClick: false }) //Disables autoclose of the popup message
          .openPopup();
        // if (marker) {
        //   marker.setLatLng([lat, lng]);
        //   marker.openPopup();
        // } else {
        //   marker = L.marker([lat, lng])
        //     .addTo(map)
        //     .bindPopup('Workout location')
        //     .openPopup();
        // }
      });
    },
    () => {
      alert(`Error, could not get your position`);
    },
  );
