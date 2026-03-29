import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToMany, JoinColumn, Index,
} from 'typeorm';
import { Product }   from './product.entity';
import { Business }  from 'src/businesses/entities/business.entity';
 
@Entity('product_categories')
@Index(['business_id', 'is_active'])
@Index(['business_id', 'name'])
@Index(['parent_id'])
export class ProductCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;
 
  @Column({ type: 'uuid' })
  @Index()
  business_id: string;
 
  // FIX : relation FK vers Business
  @ManyToOne(() => Business, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'business_id' })
  business: Business;
 
  @Column({ type: 'varchar', length: 255 })
  name: string;
 
  @Column({ type: 'text', nullable: true })
  description: string | null;
 
  @Column({ type: 'uuid', nullable: true })
  parent_id: string | null;
 
  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null;
 
  @Column({ type: 'integer', default: 0 })
  sort_order: number;
 
  @Column({ type: 'varchar', length: 500, nullable: true })
  image_url: string | null;
 
  // FIX : snake_case
  @Column({ type: 'boolean', default: true })
  is_active: boolean;
 
  // FIX : snake_case
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
 
  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
 
  @ManyToOne(() => ProductCategory, (category) => category.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parent_id' })
  parent: ProductCategory | null;
 
  @OneToMany(() => ProductCategory, (category) => category.parent)
  children: ProductCategory[];
 
  @OneToMany(() => Product, (product) => product.category)
  products: Product[];
}
 