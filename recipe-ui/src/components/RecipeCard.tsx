import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardMedia, Typography, Chip, Button, Box } from '@mui/material';
import { RecipeListItem } from '../services/api';

interface RecipeCardProps {
  recipe: RecipeListItem;
  categoryName?: string;
  cuisineName?: string;
}

const RecipeCard = ({ recipe, categoryName, cuisineName }: RecipeCardProps) => {
  return (
    <Card sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      transition: 'transform 0.3s ease, box-shadow 0.3s ease',
      '&:hover': {
        transform: 'translateY(-5px)',
        boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)'
      }
    }}>
      <CardMedia
        component="img"
        height="160"
        image={recipe.thumbnail}
        alt={recipe.name}
        sx={{ objectFit: 'cover' }}
      />
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h5" component="h2" gutterBottom>
          {recipe.name}
        </Typography>

        <Box sx={{ mb: 2 }}>
          {categoryName && (
            <Chip
              label={categoryName}
              size="small"
              sx={{ mr: 1, mb: 1 }}
              color="primary"
              variant="outlined"
            />
          )}
          {cuisineName && (
            <Chip
              label={cuisineName}
              size="small"
              sx={{ mr: 1, mb: 1 }}
              color="secondary"
              variant="outlined"
            />
          )}
        </Box>

        <Typography variant="body2" color="text.secondary" paragraph sx={{ mb: 2 }}>
          {recipe.description}
        </Typography>

        <Box sx={{ mt: 'auto' }}>
          <Button
            component={Link}
            to={`/recipes/${recipe.id}`}
            variant="contained"
            color="primary"
            fullWidth
          >
            View Recipe
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default RecipeCard;
