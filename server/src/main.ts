// server/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Включаем CORS для всех источников (для разработки это ок)
  app.enableCors();
  
  // Глобальный префикс API не нужен, если мы в контроллере пишем @Controller('api')
  // Но если ты хочешь, можно раскомментировать:
  // app.setGlobalPrefix('api'); 

  const port = process.env.PORT || 3000;
  await app.listen(port);
}
bootstrap();