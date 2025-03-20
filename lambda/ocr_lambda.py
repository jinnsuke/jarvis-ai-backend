import json
import boto3
import os

# Initialize AWS services
textract_client = boto3.client('textract')
s3_client = boto3.client('s3')
rds_client = boto3.client('rds-data')
secrets_manager = boto3.client('secretsmanager')

# Environment variables
S3_BUCKET_NAME = os.environ['mark-s-ai']
RDS_INSTANCE_ARN = os.environ['arn:aws:rds:us-east-1:104143411808:db:jarvis-ai']
RDS_SECRET_ARN = os.environ['arn:aws:secretsmanager:us-east-1:104143411808:secret:my-rds-credentials-pFtfrv']
RDS_DATABASE_NAME = os.environ['postgres']

def lambda_handler(event, context):
    # Get the image file details from the event (from API Gateway trigger)
    file_key = event['file_key']
    
    # 1. Retrieve the image from S3
    image = s3_client.get_object(Bucket=S3_BUCKET_NAME, Key=file_key)
    image_data = image['Body'].read()
    
    # 2. Process the image with AWS Textract
    response = textract_client.detect_document_text(
        Document={'Bytes': image_data}
    )
    
    # 3. Extract text from the response
    extracted_text = extract_text(response)
    
    # 4. Save the extracted data to RDS (structured format)
    save_to_rds(extracted_text)
    
    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'OCR processing completed successfully'})
    }

def extract_text(response):
    # Extract text from Textract response (you can further process this as needed)
    extracted_text = ''
    for item in response['Blocks']:
        if item['BlockType'] == 'LINE':
            extracted_text += item['Text'] + '\n'
    return extracted_text

def get_db_credentials():
    # Retrieve database credentials from Secrets Manager
    secret_response = secrets_manager.get_secret_value(SecretId=RDS_SECRET_ARN)
    secret = json.loads(secret_response['SecretString'])
    return secret['username'], secret['password']

def save_to_rds(text):
    # Get DB credentials from Secrets Manager
    username, password = get_db_credentials()
    
    # SQL statement to insert the extracted text into your RDS table
    sql_statement = f"INSERT INTO charge_forms (form_data) VALUES (:text)"
    
    # Execute the SQL statement using the RDS Data API
    rds_client.execute_statement(
        resourceArn=RDS_INSTANCE_ARN,
        secretArn=RDS_SECRET_ARN,  # Use the Secret ARN for credentials
        database=RDS_DATABASE_NAME,
        sql=sql_statement,
        parameters=[{'name': 'text', 'value': {'stringValue': text}}]  # The extracted text
    )
