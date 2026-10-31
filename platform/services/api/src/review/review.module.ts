import { Module } from '@nestjs/common';
import { ReviewService } from './review.service';
import {
  ReviewController,
  ReviewAssetController,
  ReviewRevisionController,
  ReviewAnnotationController,
} from './review.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { TaskModule } from '../task/task.module';
import { StorageModule } from '../common/storage/storage.module';

@Module({
  imports: [PrismaModule, TaskModule, StorageModule],
  controllers: [
    ReviewController,
    ReviewAssetController,
    ReviewRevisionController,
    ReviewAnnotationController,
  ],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule { }

