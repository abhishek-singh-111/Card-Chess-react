import moveSelf from "../sounds/move-self.mp3";
import captureMp3 from "../sounds/capture.mp3";
import moveCheck from "../sounds/move-check.mp3";

export const moveSound = new Audio(moveSelf);
export const captureSound = new Audio(captureMp3);
export const checkSound = new Audio(moveCheck);
export const endSound = new Audio(moveCheck); 