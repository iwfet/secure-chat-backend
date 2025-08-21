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

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  fromUser: User;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  toUser: User;

  @Column({ type: 'bytea' })
  encryptedContent: Buffer;

  @Column({ default: false })
  read: boolean;

  @CreateDateColumn()
  createdAt: Date;
}