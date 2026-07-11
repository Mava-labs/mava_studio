<!--
    DEPRECATED — retired as part of the PropertiesPanel consolidation (CLEANUP_TODO.md, Phase 3).

    This generic property-group renderer (paired with styleMatrix.ts) guessed input
    controls from property names via regex and produced auto-capitalized labels.
    StylePanel.vue no longer routes through it — it composes curated panels
    (LayoutPanel, TransformPanel, TextPanel, FillStroke, GeometryPanel, RadiusPanel,
    PaddingPanel, EffectsPanel, ImagePanel) directly by element kind/type instead.

    Safe to delete this file. Left in place only because this tool couldn't remove
    it from your filesystem directly (permission denied on the mounted folder) —
    please delete it from your file explorer / editor.
-->
<template><div style="display:none" /></template>
<script setup lang="ts" vapor></script>
