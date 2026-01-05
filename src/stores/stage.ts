import { defineStore } from "pinia";
import { Ref, ref } from "vue";

export const useStageStore = defineStore("stage", () =>{
    let currentStage: Ref<StageKey> = ref('empty');
    function setStage(key: StageKey) {
        currentStage.value = key;
    }
    return { currentStage, setStage }
})

export type StageKey = "empty" | "create" | "template" | "animate";