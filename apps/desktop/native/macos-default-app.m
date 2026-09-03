#import <AppKit/AppKit.h>
#import <Foundation/Foundation.h>

static const NSTimeInterval requestTimeoutSeconds = 120.0;

static BOOL setDefaultApplication(NSURL *applicationURL, NSURL *documentURL, NSError **error) {
  __block BOOL finished = NO;
  __block NSError *requestError = nil;

  [[NSWorkspace sharedWorkspace]
      setDefaultApplicationAtURL:applicationURL
      toOpenContentTypeOfFileAtURL:documentURL
      completionHandler:^(NSError *completionError) {
        requestError = completionError;
        finished = YES;
      }];

  NSDate *deadline = [NSDate dateWithTimeIntervalSinceNow:requestTimeoutSeconds];
  while (!finished && [deadline timeIntervalSinceNow] > 0) {
    [[NSRunLoop currentRunLoop]
        runMode:NSDefaultRunLoopMode
        beforeDate:[NSDate dateWithTimeIntervalSinceNow:0.05]];
  }

  if (!finished) {
    if (error != NULL) {
      *error = [NSError errorWithDomain:@"com.defpeter.fuxian.default-app"
                                   code:1
                               userInfo:@{NSLocalizedDescriptionKey : @"The system request timed out."}];
    }
    return NO;
  }
  if (requestError != nil) {
    if (error != NULL) {
      *error = requestError;
    }
    return NO;
  }
  return YES;
}

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    if (argc < 3) {
      fprintf(stderr, "Usage: fuxian-default-app-helper <application> <document> [...]\n");
      return 64;
    }

    if (@available(macOS 12.0, *)) {
      NSString *applicationPath = [NSString stringWithUTF8String:argv[1]];
      BOOL isDirectory = NO;
      if (![[NSFileManager defaultManager] fileExistsAtPath:applicationPath
                                               isDirectory:&isDirectory] ||
          !isDirectory) {
        fprintf(stderr, "The application bundle does not exist.\n");
        return 66;
      }

      NSURL *applicationURL = [NSURL fileURLWithPath:applicationPath isDirectory:YES];
      for (int index = 2; index < argc; index += 1) {
        NSString *documentPath = [NSString stringWithUTF8String:argv[index]];
        if (![[NSFileManager defaultManager] fileExistsAtPath:documentPath]) {
          fprintf(stderr, "A probe document does not exist.\n");
          return 66;
        }

        NSError *error = nil;
        if (!setDefaultApplication(applicationURL,
                                   [NSURL fileURLWithPath:documentPath],
                                   &error)) {
          fprintf(stderr, "%s\n", error.localizedDescription.UTF8String);
          return 1;
        }
      }
      return 0;
    }

    fprintf(stderr, "macOS 12 or later is required.\n");
    return 69;
  }
}
