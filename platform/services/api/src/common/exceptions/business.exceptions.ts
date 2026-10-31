import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Business rule exceptions for Sako platform
 */

export class SubscriptionPausedException extends HttpException {
  constructor(workspaceId: string) {
    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        message: 'Workspace subscription is paused. No operations allowed.',
        error: 'SubscriptionPaused',
        workspaceId,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class SubscriptionCanceledException extends HttpException {
  constructor(workspaceId: string) {
    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        message: 'Workspace subscription is canceled. Limited operations only.',
        error: 'SubscriptionCanceled',
        workspaceId,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class ActiveTaskLimitReachedException extends HttpException {
  constructor(currentCount: number, limit: number) {
    super(
      {
        statusCode: HttpStatus.CONFLICT,
        message: `Active task limit reached. Current: ${currentCount}, Limit: ${limit}`,
        error: 'ActiveTaskLimitReached',
        currentCount,
        limit,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class InvalidTaskTransitionException extends HttpException {
  constructor(taskId: string, currentStatus: string, attemptedStatus: string) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message: `Invalid task transition: ${currentStatus} -> ${attemptedStatus}`,
        error: 'InvalidTaskTransition',
        taskId,
        currentStatus,
        attemptedStatus,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class CategoryNotAllowedException extends HttpException {
  constructor(category: string, planCode: string, mode?: string) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message: `Category ${category} not allowed for plan ${planCode}${mode ? ` with mode ${mode}` : ''}`,
        error: 'CategoryNotAllowed',
        category,
        planCode,
        mode,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class WorkspaceNotFoundException extends HttpException {
  constructor(workspaceId: string) {
    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        message: `Workspace not found: ${workspaceId}`,
        error: 'WorkspaceNotFound',
        workspaceId,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class TaskNotFoundException extends HttpException {
  constructor(taskId: string) {
    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        message: `Task not found: ${taskId}`,
        error: 'TaskNotFound',
        taskId,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

