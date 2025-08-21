import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Segurança: Adiciona headers de segurança HTTP
  app.use(helmet());

  // Habilita CORS
  app.enableCors({
    // Lê a URL do frontend do arquivo .env
    // Se a variável não estiver definida, nenhuma origem será permitida.
    origin: 'http://localhost:5173',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // Permite que o frontend envie credenciais (como tokens)
  });

  // Validação Global: Garante que todos os dados de entrada são validados
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));


  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));


  // Documentação da API com Swagger
  const config = new DocumentBuilder()
    .setTitle('Secure Chat API')
    .setDescription('API para o sistema de chat seguro com E2EE')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(5000);
  console.log(`Aplicação rodando em: ${await app.getUrl()}`);
  console.log(`Documentação da API disponível em: ${await app.getUrl()}/api-docs`);
}
bootstrap();