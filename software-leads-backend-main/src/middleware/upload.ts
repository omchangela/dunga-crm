import multer from 'multer'

export const csvUpload = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (
            file.mimetype === 'text/csv' ||
            file.mimetype === 'application/vnd.ms-excel' ||
            file.originalname.endsWith('.csv')
        ) {
            cb(null, true)
        } else {
            cb(new Error('CSV files only'))
        }
    }
})