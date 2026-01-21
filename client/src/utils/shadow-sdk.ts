// client/src/utils/shadow-sdk.ts
import { initWASM, isWASMSupported } from '@radr/shadowwire';

let isInitialized = false;

export const initializeShadowWire = async (): Promise<boolean> => {
  if (isInitialized) return true;

  if (!isWASMSupported()) {
    console.error('❌ WebAssembly is not supported in this browser');
    return false;
  }

  try {
    console.log('⏳ Initializing ShadowWire WASM...');
    // ИСПРАВЛЕНИЕ: Передаем объект с параметром wasmUrl
    // @ts-ignore (игнорируем проверку типов если библиотека старая)
    await initWASM({ wasmUrl: '/wasm/settler_wasm_bg.wasm' });
    
    isInitialized = true;
    console.log('✅ ShadowWire Initialized Successfully');
    return true;
  } catch (error) {
    // Если объектный синтаксис не сработает (фоллбэк), пробуем по-старому
    try {
        await initWASM('/wasm/settler_wasm_bg.wasm');
        isInitialized = true;
        return true;
    } catch (retryError) {
        console.error('❌ Failed to initialize ShadowWire:', retryError);
        return false;
    }
  }
};