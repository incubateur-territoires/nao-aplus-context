declare module "aws-s3-form" {
  export class AwsS3Form {
    constructor(config: {
      accessKeyId: string;
      secretAccessKey: string;
      region: string;
      bucket: string;
    });
    upload(file: File): Promise<unknown>;
  }
}
