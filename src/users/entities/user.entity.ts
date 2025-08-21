import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { Exclude } from 'class-transformer';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  @Exclude() // Garante que este campo nunca seja retornado em respostas JSON
  password: string;

  // Adicionar campos de 2FA aqui, se necessário
}