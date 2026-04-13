/**
 * main.ts
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Composables
import { createApp } from 'vue';

// Styles
import './styles/layers.css';
import 'unfonts.css';
import './styles/tailwind.css';
import '@mdi/font/css/materialdesignicons.css';
import 'vuetify/styles';
import './styles/main.scss';

// Plugins
import { registerPlugins } from '@/plugins';

// Components
import App from './App.vue';

const app = createApp(App);

registerPlugins(app);

app.mount('#app');
