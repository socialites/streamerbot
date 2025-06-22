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

async function startStreaming(obs: OBSWebSocket) {
    try {
        await obs.call('StartStream');
        console.log('Started streaming');
    } catch (error) {
        console.warn('Failed to start streaming:', error);
    }
}

async function stopStreaming(obs: OBSWebSocket) {
    try {
        await obs.call('StopStream');
        console.log('Stopped streaming');
    } catch (error) {
        console.warn('Failed to stop streaming:', error);
    }
}

async function startVirtualCamera(obs: OBSWebSocket) {
    try {
        const result = await obs.call('StartVirtualCam');
        console.log('Started virtual camera', result);
    } catch (error) {
        console.warn('Failed to start virtual camera:', error);
    }
}

async function stopVirtualCamera(obs: OBSWebSocket) {
    try {
        await obs.call('StopVirtualCam');
        console.log('Stopped virtual camera');
    } catch (error) {
        console.warn('Failed to stop virtual camera:', error);
    }
}

async function handleCommand(command: string, {obs}: {obs: OBSWebSocket}) {
    // Check for start streaming command: !start
    if (command === 'start') {
        await startStreaming(obs);
        return;
    }

    // Check for stop streaming command: !stop
    if (command === 'stop') {
        await stopStreaming(obs);
        return;
    }

    // Check for start virtual camera command: !startvc
    if (command === 'startvc') {
        await startVirtualCamera(obs);
        return;
    }

    // Check for stop virtual camera command: !stopvc
    if (command === 'stopvc') {
        await stopVirtualCamera(obs);
        return;
    }

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
    console.warn("  !start              - Start streaming");
    console.warn("  !stop               - Stop streaming");
    console.warn("  !startvc            - Start virtual camera");
    console.warn("  !stopvc             - Stop virtual camera");
    console.warn("  !ts source on/off   - Toggle source visibility");
    console.warn("  !ss sceneName       - Switch to scene");
    console.warn("  !source on/off      - Legacy toggle source (deprecated)");
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
