# wu? interactive 3D skirt

Static Three.js application. Serve the root: `python3 -m http.server 3001`. No install/build required. Three.js is vendored under vendor with its MIT license.

The skirt is procedural mesh geometry, not video or image frames. Edit design dimensions, surface(), mesh parts and materials in script.js. Reconstructed from supplied visual references; not a dimensionally verified copy of an original garment model.

Drag to orbit, wheel/pinch to zoom. Automatic axial rotation pauses during interaction and eases back after 1.3 seconds. Reduced motion disables initial auto-rotation. No floor or cast shadows.
