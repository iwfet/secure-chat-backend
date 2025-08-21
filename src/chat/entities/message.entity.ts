import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity()
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: true }) // eager: true carrega o usuário automaticamente
  fromUser: User;

  @ManyToOne(() => User, { eager: true })
  toUser: User;

  @Column({ type: 'bytea' })
  encryptedContent: Buffer;
}