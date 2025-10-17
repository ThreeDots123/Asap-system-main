import { Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { EventEmitter2 } from "@nestjs/event-emitter";
import events from ".";

const { awaitableEvent } = events;

@Injectable()
export class EventService {
  private awaitableEvents = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (reason?: any) => void;
    }
  >();

  constructor(private readonly eventEmitter: EventEmitter2) {
    // Register to listen to responses from awaitable events

    // Listen for response in awaitable events
    this.eventEmitter.on(
      awaitableEvent.response,
      (data: { eventId: string; result?: any }) => {
        // get the awaitable event with that id
        const promise = this.awaitableEvents.get(data.eventId);
        if (promise) {
          promise.resolve(data.result ?? "");
          this.awaitableEvents.delete(data.eventId);
        }
      },
    );

    // Listen for errors in our awaitable events
    this.eventEmitter.on(
      awaitableEvent.error,
      (data: { eventId: string; error: any }) => {
        const promise = this.awaitableEvents.get(data.eventId);
        if (promise) {
          promise.reject(data.error);
          this.awaitableEvents.delete(data.eventId);
        }
      },
    );
  }

  /**
   * Emits an event without needing to wait for its completion.
   *
   * @param {string} eventName - The name of the event you wish to emit
   * @param {any} data - And object containing the event data
   */
  emit(eventName: string, data: { event: any }) {
    // Emit the event without the need for eventId included
    this.eventEmitter.emit(eventName, data);
  }

  /**
   * Emits an event and waits for event completion before proceeding.
   *
   * @param {string} eventName - The name of the event you wish to emit
   * @param {any} data - And object containing the event data
   * @returns {any} Returns value from the response, if any..
   */
  async emitAndWait<T>(
    eventName: string,
    data: { event: any; eventId: string },
  ): Promise<T> {
    const eventId = uuidv4();

    // Creating a promise that will be resolved || rejected when the response comes back using the events listened for in the constructor
    const promise = new Promise<T>((resolve, reject) => {
      this.awaitableEvents.set(eventId, { resolve, reject });
    });

    // Emit the event with the eventId included
    this.eventEmitter.emit(eventName, {
      ...data,
      eventId,
    });

    // Return the promise
    return promise;
  }
}
