<template>
    <nav>
        <div class="nav nav-tabs" role="tablist">
            <NuxtLink v-for="(text, link) in routeList" :to="link" style="color: inherit; text-decoration: inherit;">
                <button class="nav-link" type="button" role="tab" :aria-selected="isActive(link)" :class="{
                    active: isActive(link)
                }">
                    {{ text }}
                </button>
            </NuxtLink>
        </div>
    </nav>
</template>

<script setup lang="ts">
const route = useRoute();

const isActive = (path: string) => route.path === path;

const routeList = {
    "/": "Cult & Character",
    "/inventory-editor": "Inventory Editor",
    "/tarot-cards": "Tarot Cards",
    "/followers": "Followers",
    "/recruiting-followers": "Recruiting Followers",
    "/dead-followers": "Dead Followers",
    "/building-unlocks": "Building Unlocks",
    "/raw": "Raw"
}
</script>
