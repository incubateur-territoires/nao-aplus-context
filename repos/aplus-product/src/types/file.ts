export interface FileMetadata {
  id: string;
  name: string;
  type: string;
  size: number;
  lastModified: Date;
}

export interface FileReference {
  id: string;
  name: string;
}
