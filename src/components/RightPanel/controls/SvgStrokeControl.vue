<!--
    DEPRECATED — retired in CLEANUP_TODO.md Phase 3. Its responsibility (SVG
    stroke) is now handled by FillStroke.vue, which also covers container/input
    background+border through the same UI. This file also had a real bug worth
    knowing about: it read/wrote `stroke.dash` and `stroke.cap` fields that
    don't exist on the SvgStyle type (only color/width/style do), so those
    controls never had any rendering effect. No longer imported anywhere. Safe
    to delete; left in place only because this tool couldn't remove it from
    your filesystem directly (permission denied on the mounted folder).
-->
<template><div style="display:none" /></template>
<script setup lang="ts" vapor></script>
