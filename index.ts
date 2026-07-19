import 'react-native-gesture-handler';

import { initRTL } from './lib/rtl';
initRTL();

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
