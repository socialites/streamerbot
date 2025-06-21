import { OBSWebSocket } from "obs-websocket-js";

async function findSceneItemIdRecursive(obs: OBSWebSocket, sceneName: string, sourceName: string): Promise<{ sceneName: string; sceneItemId: number } | null> {
    const { sceneItems } = await obs.call('GetSceneItemList', { sceneName });

    for (const item of sceneItems) {
        if (item.sourceName === sourceName) {
            return { sceneName, sceneItemId: Number(item.sceneItemId) };
        }

        if (item.sourceType === 'OBS_SOURCE_TYPE_SCENE' && !item.isGroup) {
            const result = await findSceneItemIdRecursive(obs, String(item.sourceName), sourceName);
            if (result) return result;
        }

        if (item.isGroup) {
            const { sceneItems: groupItems } = await obs.call('GetGroupSceneItemList', { sceneName: String(item.sourceName) });
            for (const groupItem of groupItems) {
                if (groupItem.sourceName === sourceName) {
                    return { sceneName: String(item.sourceName), sceneItemId: Number(groupItem.sceneItemId) };
                }

                if (groupItem.isGroup) {
                    const result = await findSceneItemIdRecursive(obs, String(item.sourceName), sourceName);
                    if (result) return result;
                }
            }
        }
    }

    return null;
}


async function setSourceVisibility(obs: OBSWebSocket, sourceName: string, visible: boolean) {
    const { currentProgramSceneName } = await obs.call('GetCurrentProgramScene');

    const result = await findSceneItemIdRecursive(obs, currentProgramSceneName, sourceName);

    if (result) {
        await obs.call('SetSceneItemEnabled', {
            sceneName: result.sceneName,
            sceneItemId: result.sceneItemId,
            sceneItemEnabled: visible
        });
        console.log(`Source "${sourceName}" visibility in scene "${result.sceneName}" set to: ${visible} in ${currentProgramSceneName}`);
    } else {
        console.warn(`Source "${sourceName}" not found in any nested scene within "${currentProgramSceneName}".`);
    }
}

async function switchScene(obs: OBSWebSocket, sceneName: string) {
    try {
        await obs.call('SetCurrentProgramScene', { sceneName });
        console.log(`Switched to scene: "${sceneName}"`);
    } catch (error) {
        console.warn(`Failed to switch to scene "${sceneName}":`, error);
    }
}

async function handleCommand(command: string, {obs}: {obs: OBSWebSocket}) {
    // Check for ts command (toggle source): !ts source on/off
    const tsMatch = command.match(/^ts (?<source>.+?) (?<bool>on|off)$/);
    if (tsMatch) {
        const { source, bool } = tsMatch.groups!;
        await setSourceVisibility(obs, source, bool === "on");
        return;
    }

    // Check for ss command (switch scene): !ss sceneName
    const ssMatch = command.match(/^ss (?<sceneName>.+)$/);
    if (ssMatch) {
        const { sceneName } = ssMatch.groups!;
        await switchScene(obs, sceneName);
        return;
    }

    // Legacy support for old format: !source on/off
    const legacyMatch = command.match(/^(?<source>.+?) (?<bool>on|off)$/);
    if (legacyMatch) {
        const { source, bool } = legacyMatch.groups!;
        await setSourceVisibility(obs, source, bool === "on");
        return;
    }

    // If no valid command format found
    console.warn("Invalid command format:", command);
    console.warn("Supported formats:");
    console.warn("  !ts source on/off  - Toggle source visibility");
    console.warn("  !ss sceneName      - Switch to scene");
    console.warn("  !source on/off     - Legacy toggle source (deprecated)");
}

async function registerObsEvents({obs}: {obs: OBSWebSocket}) {
    obs.on('SceneItemEnableStateChanged', (event) => {
        console.log(event);
    });
    obs.on('InputSettingsChanged', (event) => {
        console.log(event);
    });
}

export { handleCommand, registerObsEvents };
