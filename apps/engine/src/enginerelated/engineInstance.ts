import { Engine } from "./engine";

let EngineInstance: Engine;

export function getEngine() {
    if (!EngineInstance) {
        EngineInstance = new Engine()
    }
    return EngineInstance
}