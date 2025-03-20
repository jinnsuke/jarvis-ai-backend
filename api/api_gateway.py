import json
import boto3
import uuid

s3_client = boto3.client('s3')
API_BUCKET_NAME = 'your-s3-bucket-name'

def lambda_handler(event, context):
    # Parse the incoming file from the frontend (via API Gateway)
    file_content = event['body']  # You may need to handle the base64 content if it's uploaded directly
    file_extension = event['headers']['file-extension']
    file_key = str(uuid.uuid4()) + '.' + file_extension  # Unique file name

    # 1. Upload the file to S3
    s3_client.put_object(Bucket=API_BUCKET_NAME, Key=file_key, Body=file_content)
    
    # 2. Trigger Lambda function for OCR processing
    lambda_client = boto3.client('lambda')
    lambda_client.invoke(
        FunctionName='ocr_lambda_function_name',  # Replace with your actual Lambda function name
        InvocationType='Event',
        Payload=json.dumps({'file_key': file_key})
    )
    
    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'File uploaded and OCR triggered successfully'})
    }
