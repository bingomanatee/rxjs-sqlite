import type { RxPlugin } from 'rxdb';

declare module 'rxdb' {
  interface RxDatabaseCreator<RxDocumentType, RxQueryResult, InitData> {
    devMode?: boolean;
  }

  interface RxDocumentData<RxDocType> {
    id?: string;
  }

  interface RxDocumentWriteData<RxDocType> {
    id?: string;
  }

  interface RxAttachmentData {
    data?: any;
  }

  namespace RxDBDevModePlugin {
    function disableWarnings(): void;
  }
}
