# PDF Upload and Auto-fill Feature

## Overview

This feature allows users to upload a PDF bill document and automatically extract relevant information to fill in the bill form fields.

## How it Works

1. **PDF Upload**: Users can upload a PDF file using the file input in the "New Bill" form
2. **Text Extraction**: The system uses PDF.js to extract text content from the uploaded PDF
3. **Field Recognition**: The extracted text is analyzed using regex patterns to identify relevant information
4. **Auto-fill**: Recognized fields are automatically populated in the form

## Supported Fields

The system can extract the following information from PDF bills:

- **Landlord Name**: Recognizes patterns like "Smt. [Name]", "Mr. [Name]", "Landlord: [Name]"
- **Amount**: Finds amounts in formats like "Rs. 12000/-", "Amount: Rs. 12000"
- **Rate**: Identifies rates like "Rs. 12000/P.M", "Rate: 12000 P.M"
- **Bill Number**: Extracts bill numbers from "BILL NO: 123", "Bill Number: 123"
- **Date**: Recognizes various date formats (DD/MM/YYYY, YYYY/MM/DD)
- **Period**: Identifies month-year combinations like "JANUARY-2024"
- **Agreement Date**: Finds agreement dates in formats like "Agreement Date: DD/MM/YYYY"

## Usage

1. Navigate to the "New Bill" page
2. Look for the "Upload PDF to Auto-fill" section at the top of the form
3. Click "Choose File" and select a PDF bill document
4. Wait for processing (you'll see a "Processing PDF..." message)
5. Once complete, the form fields will be automatically filled with extracted information
6. Review and modify the extracted data as needed
7. Complete the form and generate your bill

## Technical Implementation

- **PDF Processing**: Uses `pdfjs-dist` library for text extraction
- **Pattern Matching**: Regex patterns to identify and extract specific field types
- **Form Integration**: Seamlessly integrates with React Hook Form
- **Error Handling**: Provides clear feedback for processing errors and missing data

## Error Handling

- **Invalid File Type**: Shows error for non-PDF files
- **Processing Errors**: Displays error message if PDF processing fails
- **No Data Found**: Warns if no relevant information is found in the PDF
- **Success Feedback**: Shows success message with number of fields extracted

## Dependencies

- `pdfjs-dist`: For PDF text extraction
- `pdf-parse`: Alternative PDF parsing (installed but not currently used)

## Future Enhancements

- OCR support for scanned PDFs
- Machine learning for better field recognition
- Support for more document formats
- Batch processing for multiple PDFs
- Custom field mapping configuration
