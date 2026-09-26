/**
 * The ONE set of pickup/destination map pins used across the Passenger booking flow (booking and
 * confirmation map, Pin Location screen). Static bitmaps (28x36 at 1x with @2x/@3x), cropped so the
 * pin's tip is the bottom-center pixel — pair with `anchor={{ x: 0.5, y: 1 }}` so the tip is the
 * exact coordinate at every zoom.
 */
export const PICKUP_PIN_IMAGE = require('../../assets/map/pin-pickup.png');
export const DESTINATION_PIN_IMAGE = require('../../assets/map/pin-destination.png');
