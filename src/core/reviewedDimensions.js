import * as THREE from 'three';
import { createDimensions } from './dimensions.js';

// Preserve the original dimension renderer. Translating a private camera lets
// its ground-based anchors follow the assembly's actual bottom, including feet.
export function createReviewedDimensions(svg, camera, renderer) {
  let source = camera;
  let projected = source.clone();
  projected.parent = null;
  const dimensions = createDimensions(svg, projected, renderer);
  const worldPosition = new THREE.Vector3();
  return {
    update(bounds, center) {
      projected.copy(source, false);
      source.getWorldPosition(worldPosition);
      projected.position.copy(worldPosition);
      projected.position.y -= bounds.minY || 0;
      source.getWorldQuaternion(projected.quaternion);
      source.getWorldScale(projected.scale);
      projected.updateMatrixWorld(true);
      dimensions.update(bounds, center);
    },
    setCamera(next) {
      source = next;
      projected = next.clone();
      projected.parent = null;
      dimensions.setCamera(projected);
    },
  };
}
