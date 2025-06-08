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


async function handleCommand(command: string, {obs}: {obs: OBSWebSocket}) {
    switch (command) {
        case "pc off": {
            await setSourceVisibility(obs, "U40 CAM", false);
            break;
        }
        case "pc on": {
            await setSourceVisibility(obs, "U40 CAM", true);
            break;
        }
        case "phone on": {
            await setSourceVisibility(obs, "iPhone SRT Stream", true);
            break;
        }
        case "phone off": {
            await setSourceVisibility(obs, "iPhone SRT Stream", false);
            break;
        }
        default:
            console.warn("Unknown command", command);
            break;
    }
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
