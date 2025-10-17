import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Handle responses that are returned explicitly
@Injectable()
export class ResponseTransformerInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();

    const success =
      response.statusCode >= 200 && response.statusCode <= 299 ? true : false;

    return next.handle().pipe(
      map((data) => {
        return {
          success,
          ...(success ? { data } : { ...data }),
        };
      }),
    );
  }
}
