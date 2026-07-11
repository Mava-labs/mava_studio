<!--
    DEPRECATED — retired in CLEANUP_TODO.md Phase 3, replaced by GeometryPanel.vue.
    This file had a real bug worth knowing about: it read/wrote element.attributes
    (a generic bag), but SvgElement geometry actually lives on the first-class
    `geometry` field (types/element.ts) — so this control never actually edited
    real shape geometry. No longer imported anywhere. Safe to delete; left in
    place only because this tool couldn't remove it from your filesystem
    directly (permission denied on the mounted folder).
-->
<template><div style="display:none" /></template>
<script setup lang="ts" vapor></script>
