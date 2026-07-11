<!--
    DEPRECATED — retired in CLEANUP_TODO.md Phase 3. Its responsibility (SVG
    fill color) is now handled by FillStroke.vue, which also covers container/
    input background+border through the same UI. This file also had a real
    bug worth knowing about: it read/wrote a plain `attributes.fillRule` field
    that doesn't exist anywhere in the SvgStyle type, so it never affected
    rendering. No longer imported anywhere. Safe to delete; left in place only
    because this tool couldn't remove it from your filesystem directly
    (permission denied on the mounted folder).
-->
<template><div style="display:none" /></template>
<script setup lang="ts" vapor></script>
