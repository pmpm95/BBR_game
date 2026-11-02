import { defineConfig } from 'vite';
import { managedApps } from '@microsoft/managed-apps-vite-plugin';

// devMode: 'localGateway' → `ms app dev` 로컬 실행 시에도 내장 앱 상태(state)를 사용할 수 있게 함
export default defineConfig({
  plugins: [managedApps({ devMode: 'localGateway' })],
});
