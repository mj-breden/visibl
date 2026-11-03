# VISIBL: Variable IntenSIty Brake Lights

A simulation project testing whether brake lights that carry more information
(how hard the driver is braking) improve following drivers' reactions and
reduce collisions, compared with a conventional on/off brake light.

## Hypothesis

- **H0 (null):** Brake light style has no effect on following drivers' reaction
  time, braking response, or collision rate.
- **H1:** Brake lights that encode braking severity (brightness, lit area, or
  flash rate) produce faster or better-matched reactions and fewer collisions
  than the conventional on/off control.

This prototype is for exploration. A formal protocol (sample size, randomisation,
pre-specified tests) will come before any results are reported.

## Run the prototype

No build step. Open `index.html` in a browser (Chrome or Edge recommended for
gamepad support).

| Input | How |
|-------|-----|
| Gamepad (best) | Squeeze the right trigger; harder squeeze is harder braking |
| Keyboard / mouse | Hold Space, Down arrow, or a mouse button; pressure ramps up while held |

All inputs are reduced to a single 0-1 "pedal pressure" in `js/input.js`, so a
load-cell pedal can be added later without touching the simulation.

## Brake light styles

| Style | What changes with braking severity |
|-------|------------------------------------|
| Control | Nothing: lamps are simply on or off |
| Variable brightness | Lamp brightness |
| Variable lit area | Number of lit bars in each lamp (1-4) |
| Variable flash rate | Flash frequency (1-8 Hz) |
| Centre-out light bar | One full-width LED bar (about half the trunk height) **replaces** the regular brake lights, including the third lamp. It fills from the centre outward in proportion to braking severity (decel / 8 m/s², minimum 12%). At lock-up (decel >= 8 m/s²) the centre flashes a white strobe at 10 Hz. Like the other styles it shows a dim running light at dusk and night. |

## Scene

A driver's-eye view from inside a car. Pick the lead **vehicle** (sedan, SUV, pickup,
or a random one each trial) and the **lighting** (day, dusk, night) from the
dropdowns. Lamps are LED-style lenses with bloom, a red wash on the road, and a
dim running light at dusk and night. Paint colour is fixed per vehicle, and the
lead car does not pitch when braking, so the lamps are the only braking cue.

To preview a frozen braking scene (handy for screenshots), add query parameters:
`index.html?demo=1&style=bar&vehicle=pickup&env=night&decel=8&gap=10`
(add `&perf=1` to show average draw time per frame in the page title).

## What is measured per trial

Reaction time (lead lights on to pedal above 5%), peak pedal pressure, minimum
gap, and whether a collision occurred. Use **Download CSV** to export.

## Layout

- `js/sim.js`: simulation core, no DOM, testable in node
- `js/input.js`: brake input sources
- `js/render.js`: canvas drawing
- `js/main.js`: wiring and stats panel
