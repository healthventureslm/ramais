import { registerRootComponent } from 'expo';
import { registrarSegundoPlano } from './src/notificacoes';
import App from './src/App';

// Precisa ser registrado antes de qualquer tela: é o que roda com o app fechado.
registrarSegundoPlano();
registerRootComponent(App);
