import { defineStore } from "pinia";
import { Ref, ref } from "vue";
import { tauriStorage } from "../utils/tauriStorage";

export const useStageStore = defineStore("stage", () =>{
    let currentStage: Ref<StageKey> = ref('empty');
    function setStage(key: StageKey) {
        currentStage.value = key;
    }
    return { currentStage, setStage }
},
{    persist: {
        storage: tauriStorage as any,
        pick: ['currentStage']
    }
});
    

export type StageKey = "empty" | "create" | "template" | "animate";