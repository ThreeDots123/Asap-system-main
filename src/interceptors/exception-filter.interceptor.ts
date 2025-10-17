import {
  Catch,
  ExceptionFilter as Filter,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

// Handle responses that are thrown by exceptions
@Catch()
export class ExceptionFilter implements Filter {
  private readonly logger = new Logger(ExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const error =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    this.logger.error(`Exception: ${exception}`);

    // Handle thrown errors
    response.status(status).json({
      success: false,
      error,
    });
  }
}
